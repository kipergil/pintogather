import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import { Callout, Marker, Polyline, type LatLng } from "react-native-maps";
import type MapView from "react-native-maps";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinForm, type PinFormValue } from "@/components/PinForm";
import { ShareSheet } from "@/components/ShareSheet";
import { useAddPin, useCloneMap, useDeletePin, useMap, useReorderPins } from "@/hooks/useMaps";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PIN_COLOR_HEX, PIN_ICON_IONICON, resolvePinStyle } from "@/lib/pin-styles";
import { signInHref } from "@/lib/authNav";
import { VenueSearchSheet, type VenueResult } from "@/components/VenueSearchSheet";
import { haversineDistanceKm, sortPinsForRoute, totalRouteDistanceKm } from "../../../shared/geo";
import type { Pin } from "../../../shared/schema";

// Central London — same fallback the web app's map component uses when a
// map has no pins yet to derive a center from (client/src/components/simple-google-map.tsx).
const DEFAULT_REGION = { latitude: 51.5074, longitude: -0.1278 };

// Clustering logic (mirrors client/src/components/simple-google-map.tsx):
// below this many pins, clustering isn't worth the overhead — every pin
// just shows individually, at every zoom level. At or above it, pins group
// into clusters when zoomed out (or just crowded together), but still fall
// back to individual markers once zoomed in past CLUSTER_MAX_ZOOM.
const CLUSTER_MIN_PIN_COUNT = 12;
const CLUSTER_MAX_ZOOM = 15;
const CLUSTER_RADIUS = 60;

const EMPTY_PIN_FORM: PinFormValue = {
  userName: "",
  twitterHandle: "",
  instagramHandle: "",
  linkedinHandle: "",
  note: "",
  photoUrl: null,
  pinColor: null,
  pinIcon: null,
};

export default function MapDetailScreen() {
  const { isSignedIn } = useAuth();
  const { shareUrl, pin: focusPinId } = useLocalSearchParams<{ shareUrl: string; pin?: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();
  const { data: map, isLoading, error } = useMap(shareUrl);
  const addPin = useAddPin(shareUrl);
  const deletePin = useDeletePin(shareUrl);
  const reorderPins = useReorderPins(shareUrl);
  const cloneMap = useCloneMap(shareUrl);
  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;

  // Set the instant the map is tapped, before the user has committed to a pin
  // there — shows a temporary marker + a "Drop a pin here?" confirm/cancel
  // bar instead of opening the full Add Pin sheet right away, so a mis-tap
  // doesn't fall straight into the form. Tapping elsewhere just moves it.
  const [pendingConfirmCoordinate, setPendingConfirmCoordinate] = useState<LatLng | null>(null);
  const [pendingCoordinate, setPendingCoordinate] = useState<LatLng | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [pinForm, setPinForm] = useState<PinFormValue>(EMPTY_PIN_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [venueSearchVisible, setVenueSearchVisible] = useState(false);
  const [forkedFromSheetVisible, setForkedFromSheetVisible] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const mapRef = useRef<MapView>(null);

  const orderedPins = useMemo(() => (map ? sortPinsForRoute(map.pins) : []), [map]);
  const routeCoordinates = useMemo(
    () => orderedPins.map((pin) => ({ latitude: Number(pin.latitude), longitude: Number(pin.longitude) })),
    [orderedPins],
  );
  const totalRouteKm = useMemo(() => totalRouteDistanceKm(orderedPins), [orderedPins]);

  const moveStop = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= orderedPins.length) return;
    const newOrder = orderedPins.map((pin) => pin.id);
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved);
    reorderPins.mutate(newOrder);
  };

  const initialRegion = useMemo(() => {
    const firstPin = map?.pins[0];
    const center = firstPin
      ? { latitude: Number(firstPin.latitude), longitude: Number(firstPin.longitude) }
      : DEFAULT_REGION;
    return { ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [map?.pins]);

  // Deep link from Search (?pin=<id>) — focuses that pin once the map's
  // pins have loaded. Consumed once so it doesn't re-fire on background
  // refetches; mirrors the web app's equivalent in map-detail.tsx.
  const consumedFocusPinRef = useRef(false);
  useEffect(() => {
    if (consumedFocusPinRef.current || !focusPinId || !map) return;
    const target = map.pins.find((pin) => pin.id === focusPinId);
    if (!target) return;
    consumedFocusPinRef.current = true;
    setSelectedPin(target);
    mapRef.current?.animateToRegion(
      { latitude: Number(target.latitude), longitude: Number(target.longitude), latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500,
    );
  }, [focusPinId, map]);

  const openAddPinModal = (coordinate: LatLng) => {
    setPendingCoordinate(coordinate);
    setPendingAddress(null);
    setPinForm({
      ...EMPTY_PIN_FORM,
      userName: user?.fullName || user?.primaryEmailAddress?.emailAddress || "",
    });
    setSubmitError(null);
  };

  const onVenueSelected = (place: VenueResult) => {
    setVenueSearchVisible(false);
    setPendingCoordinate({ latitude: Number(place.latitude), longitude: Number(place.longitude) });
    setPendingAddress(place.address);
    // Name the pin after the venue so search-built maps read as a list of
    // places, mirroring client/src/components/add-pin-modal.tsx's handlePlaceSelect.
    setPinForm({ ...EMPTY_PIN_FORM, userName: place.name });
    setSubmitError(null);
  };

  const closeAddPinModal = () => {
    setPendingCoordinate(null);
    setPendingAddress(null);
    setSubmitError(null);
  };

  const onSubmitPin = async () => {
    if (!pendingCoordinate) return;
    if (!pinForm.userName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    setSubmitError(null);
    try {
      const pin = await addPin.mutateAsync({
        userName: pinForm.userName.trim(),
        latitude: String(pendingCoordinate.latitude),
        longitude: String(pendingCoordinate.longitude),
        address: pendingAddress || undefined,
        note: pinForm.note.trim() || undefined,
        twitterHandle: pinForm.twitterHandle.trim() || undefined,
        instagramHandle: pinForm.instagramHandle.trim() || undefined,
        linkedinHandle: pinForm.linkedinHandle.trim() || undefined,
        photoUrl: pinForm.photoUrl,
        pinColor: map?.hasPinCustomization ? pinForm.pinColor : undefined,
        pinIcon: map?.hasPinCustomization ? pinForm.pinIcon : undefined,
      });
      closeAddPinModal();
      if (!pin.approved) {
        Alert.alert("Pin added", "Your pin is pending the map owner's approval before it's visible to others.");
      }
    } catch (err: any) {
      setSubmitError(err?.message ?? "Couldn't add that pin.");
    }
  };

  const canModifyPin = (pin: Pin) => isOwner || (!!currentUser && currentUser.id === pin.userId);

  const onClone = () => {
    Alert.alert("Clone this map?", "Creates your own editable copy, permanently credited back to this original.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clone",
        onPress: async () => {
          try {
            const cloned = await cloneMap.mutateAsync();
            router.replace(`/map/${cloned.shareUrl}`);
          } catch (err: any) {
            Alert.alert("Couldn't clone map", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  const onDeletePin = (pin: Pin) => {
    Alert.alert("Delete pin?", `Remove "${pin.userName}"'s pin from this map.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePin.mutateAsync(pin.id);
            setSelectedPin(null);
          } catch (err: any) {
            Alert.alert("Couldn't delete pin", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: map?.name ?? "Map",
          headerTitle: () => (
            <View className="flex-row items-center gap-1.5" style={{ maxWidth: 200 }}>
              <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
                {map?.name ?? "Map"}
              </Text>
              {!!map?.forkedFromMapId && (
                <Pressable onPress={() => setForkedFromSheetVisible(true)} hitSlop={8} testID="button-forked-from">
                  <Ionicons name="git-branch-outline" size={16} color="#64748b" />
                </Pressable>
              )}
            </View>
          ),
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              <Pressable hitSlop={8} onPress={() => setShareSheetVisible(true)} testID="button-share-map">
                <Ionicons name="share-outline" size={22} color="#2563EB" />
              </Pressable>
              {isSignedIn && (
                <Pressable hitSlop={8} onPress={onClone} testID="button-clone-map">
                  <Ionicons name="git-branch-outline" size={22} color="#2563EB" />
                </Pressable>
              )}
              {isOwner && (
                <Link href={`/map/edit/${shareUrl}`} asChild>
                  <Pressable hitSlop={8} testID="button-edit-map">
                    <Ionicons name="settings-outline" size={22} color="#2563EB" />
                  </Pressable>
                </Link>
              )}
            </View>
          ),
        }}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error || !map ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load this map" description="Check your connection and try again." />
      ) : (
        <>
          <ClusteredMapView
            ref={mapRef}
            className="flex-1"
            initialRegion={initialRegion}
            onPress={(e) => setPendingConfirmCoordinate(e.nativeEvent.coordinate)}
            // Android fires POI taps (a restaurant, landmark, etc.) as onPoiClick
            // instead of onPress, so without this a tap on one of those icons
            // silently did nothing instead of dropping a pin — mirrors the
            // clickableIcons:false fix on the web map (client/src/components/
            // simple-google-map.tsx). No iOS equivalent hook exists in
            // react-native-maps; iOS POI taps are a platform limitation.
            onPoiClick={(e) => setPendingConfirmCoordinate(e.nativeEvent.coordinate)}
            clusterColor="#2563EB"
            clusteringEnabled={map.pins.length >= CLUSTER_MIN_PIN_COUNT}
            radius={CLUSTER_RADIUS}
            maxZoom={CLUSTER_MAX_ZOOM}
          >
            {map.pins.map((pin) => {
              const style = resolvePinStyle(pin, map);
              const hex = style.color ? PIN_COLOR_HEX[style.color] : "#3B82F6";
              return (
                <Marker
                  key={pin.id}
                  coordinate={{ latitude: Number(pin.latitude), longitude: Number(pin.longitude) }}
                  title={pin.userName}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onCalloutPress={() => setSelectedPin(pin)}
                >
                  <View
                    className="items-center justify-center rounded-full border-2 border-white"
                    style={{ width: 28, height: 28, backgroundColor: hex, opacity: pin.approved ? 1 : 0.55 }}
                  >
                    <Ionicons name={style.icon ? PIN_ICON_IONICON[style.icon] : "location"} size={14} color="#ffffff" />
                  </View>
                  <Callout>
                    <View className="max-w-[220px] gap-1 p-1">
                      {pin.photoUrl && (
                        <Image source={{ uri: pin.photoUrl }} className="mb-1 h-24 w-full rounded-md" resizeMode="cover" />
                      )}
                      <Text className="font-semibold text-slate-900">{pin.userName}</Text>
                      {pin.note && <Text className="text-sm text-slate-600">{pin.note}</Text>}
                      {pin.address && <Text className="text-xs text-slate-400">{pin.address}</Text>}
                      {!pin.approved && <Text className="text-xs font-medium text-amber-600">Pending approval</Text>}
                      <Text className="text-xs text-primary">Tap for details</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
            {routeMode && routeCoordinates.length > 1 && (
              <Polyline coordinates={routeCoordinates} strokeColor="#2563EB" strokeWidth={3} />
            )}
            {pendingConfirmCoordinate && (
              <Marker coordinate={pendingConfirmCoordinate} anchor={{ x: 0.5, y: 0.5 }} tappable={false}>
                <View className="h-[22px] w-[22px] rounded-full border-2 border-white bg-primary" />
              </Marker>
            )}
          </ClusteredMapView>

          {!isSignedIn && (
            <View className="absolute left-4 right-4 top-4 rounded-xl bg-amber-50 px-3.5 py-2.5" testID="guest-notice">
              <Text className="text-xs text-amber-800">
                Viewing as a guest — pins save anonymously.{" "}
                <Link href={signInHref(`/map/${shareUrl}`)} className="font-semibold underline">
                  Sign in
                </Link>{" "}
                to manage your own maps.
              </Text>
            </View>
          )}

          {map.pins.length > 1 && (
            <Pressable
              onPress={() =>
                mapRef.current?.fitToCoordinates(
                  map.pins.map((pin) => ({ latitude: Number(pin.latitude), longitude: Number(pin.longitude) })),
                  { edgePadding: { top: 80, right: 40, bottom: 120, left: 40 }, animated: true },
                )
              }
              className="absolute bottom-24 right-4 h-11 w-11 items-center justify-center rounded-full bg-white shadow"
              testID="button-fit-all-pins"
            >
              <Ionicons name="scan-outline" size={20} color="#2563EB" />
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setPendingConfirmCoordinate(null);
              setVenueSearchVisible(true);
            }}
            className="absolute bottom-24 left-4 h-11 w-11 items-center justify-center rounded-full bg-white shadow"
            testID="button-search-venue"
          >
            <Ionicons name="search-outline" size={20} color="#2563EB" />
          </Pressable>

          <View className="absolute bottom-6 left-4 right-4 flex-row items-center justify-between rounded-2xl bg-white/95 px-4 py-3 shadow">
            {pendingConfirmCoordinate ? (
              <>
                <Text className="text-sm font-medium text-slate-700">Drop a pin here?</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setPendingConfirmCoordinate(null)}
                    className="rounded-full bg-slate-100 px-3.5 py-1.5"
                    testID="button-cancel-pending-pin"
                  >
                    <Text className="text-xs font-semibold text-slate-600">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      openAddPinModal(pendingConfirmCoordinate);
                      setPendingConfirmCoordinate(null);
                    }}
                    className="rounded-full bg-primary px-3.5 py-1.5"
                    testID="button-confirm-pending-pin"
                  >
                    <Text className="text-xs font-semibold text-white">Confirm</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location" size={16} color="#2563EB" />
                  <Text className="text-sm font-medium text-slate-700">
                    {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
                  </Text>
                </View>
                <Text className="text-xs text-slate-400">Tap the map or search to add a pin</Text>
              </>
            )}
          </View>
        </>
      )}

      <Modal visible={routeMode} animationType="slide" transparent onRequestClose={() => setRouteMode(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] rounded-t-3xl bg-white p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-slate-900">Route</Text>
                <Text className="text-xs text-slate-500">{totalRouteKm.toFixed(1)} km total, as the crow flies</Text>
              </View>
              <Pressable onPress={() => setRouteMode(false)} hitSlop={8} testID="button-close-route">
                <Ionicons name="close" size={22} color="#64748b" />
              </Pressable>
            </View>
            <ScrollView>
              {orderedPins.map((pin, index) => (
                <View key={pin.id} className="mb-2 flex-row items-center gap-3 rounded-xl border border-slate-200 p-3" testID={`row-route-pin-${pin.id}`}>
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <Text className="text-xs font-semibold text-primary">{index + 1}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-medium text-slate-900" numberOfLines={1}>{pin.userName}</Text>
                    {index > 0 && (
                      <Text className="text-xs text-slate-400">{haversineDistanceKm(orderedPins[index - 1], pin).toFixed(1)} km from previous</Text>
                    )}
                  </View>
                  {isOwner && (
                    <View className="flex-row gap-1">
                      <Pressable
                        onPress={() => moveStop(index, -1)}
                        disabled={index === 0}
                        className={`h-8 w-8 items-center justify-center rounded-full ${index === 0 ? "opacity-30" : "bg-slate-100"}`}
                        testID={`button-move-up-${pin.id}`}
                      >
                        <Ionicons name="chevron-up" size={16} color="#334155" />
                      </Pressable>
                      <Pressable
                        onPress={() => moveStop(index, 1)}
                        disabled={index === orderedPins.length - 1}
                        className={`h-8 w-8 items-center justify-center rounded-full ${index === orderedPins.length - 1 ? "opacity-30" : "bg-slate-100"}`}
                        testID={`button-move-down-${pin.id}`}
                      >
                        <Ionicons name="chevron-down" size={16} color="#334155" />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
              {orderedPins.length === 0 && <Text className="text-sm italic text-slate-400">No pins to route yet.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingCoordinate} animationType="slide" transparent onRequestClose={closeAddPinModal}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[85%] rounded-t-3xl bg-white p-6">
            <Text className="text-lg font-bold text-slate-900">Add a pin</Text>
            {pendingAddress && <Text className="mb-4 mt-0.5 text-xs text-slate-500">{pendingAddress}</Text>}
            <ScrollView className={pendingAddress ? "" : "mt-4"}>
              <PinForm
                value={pinForm}
                onChange={setPinForm}
                noteLabel={map?.noteLabel || "Note"}
                notePrompt={map?.notePrompt ?? null}
                hasPinCustomization={!!map?.hasPinCustomization}
                profileSocials={
                  currentUser
                    ? {
                        twitterHandle: currentUser.twitterHandle ?? "",
                        instagramHandle: currentUser.instagramHandle ?? "",
                        linkedinHandle: currentUser.linkedinHandle ?? "",
                      }
                    : undefined
                }
              />
            </ScrollView>
            {submitError && <Text className="mt-3 text-sm text-red-600">{submitError}</Text>}
            <View className="mt-4 flex-row gap-3">
              <Button variant="outline" className="flex-1" onPress={closeAddPinModal}>
                Cancel
              </Button>
              <Button className="flex-1" loading={addPin.isPending} onPress={onSubmitPin} testID="button-submit-pin">
                Drop pin
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedPin} animationType="slide" transparent onRequestClose={() => setSelectedPin(null)}>
        {selectedPin && (
          <View className="flex-1 justify-end bg-black/40">
            <View className="gap-3 rounded-t-3xl bg-white p-6">
              {selectedPin.photoUrl && (
                <Image source={{ uri: selectedPin.photoUrl }} className="h-40 w-full rounded-xl" resizeMode="cover" />
              )}
              <Text className="text-lg font-bold text-slate-900">{selectedPin.userName}</Text>
              {!selectedPin.approved && <Text className="text-sm font-medium text-amber-600">Pending the owner's approval</Text>}
              {selectedPin.note && <Text className="text-sm text-slate-600">{selectedPin.note}</Text>}
              {selectedPin.address && <Text className="text-xs text-slate-400">{selectedPin.address}</Text>}
              {selectedPin.googleMapsUrl && (
                <Pressable onPress={() => Linking.openURL(selectedPin.googleMapsUrl!)} testID="link-google-maps">
                  <Text className="text-sm font-medium text-primary">Open in Google Maps</Text>
                </Pressable>
              )}
              {canModifyPin(selectedPin) && (
                <View className="mt-2 flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => {
                      const pin = selectedPin;
                      setSelectedPin(null);
                      router.push(`/map/edit-pin/${shareUrl}/${pin.id}`);
                    }}
                    testID="button-edit-pin"
                  >
                    Edit
                  </Button>
                  <Button variant="destructive" className="flex-1" onPress={() => onDeletePin(selectedPin)} testID="button-delete-pin">
                    Delete
                  </Button>
                </View>
              )}
              <Button variant="ghost" onPress={() => setSelectedPin(null)}>
                Close
              </Button>
            </View>
          </View>
        )}
      </Modal>

      {map && (
        <ShareSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} mapName={map.name} shareUrl={shareUrl} />
      )}

      <VenueSearchSheet visible={venueSearchVisible} onClose={() => setVenueSearchVisible(false)} onSelect={onVenueSelected} />

      <Modal
        visible={forkedFromSheetVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setForkedFromSheetVisible(false)}
      >
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-8" onPress={() => setForkedFromSheetVisible(false)}>
          <Pressable className="w-full max-w-xs gap-2 rounded-2xl bg-white p-5" onPress={(e) => e.stopPropagation()}>
            {map?.forkedFrom ? (
              <>
                <Text className="text-xs text-slate-500">Forked from</Text>
                <Pressable
                  onPress={() => {
                    setForkedFromSheetVisible(false);
                    router.push(`/map/${map.forkedFrom!.shareUrl}`);
                  }}
                  testID="link-forked-from"
                >
                  <Text className="text-base font-semibold text-primary">{map.forkedFrom.name}</Text>
                </Pressable>
                {map.forkedFrom.ownerName && <Text className="text-xs text-slate-500">by {map.forkedFrom.ownerName}</Text>}
              </>
            ) : (
              <Text className="text-sm text-slate-500">Forked from a map that's no longer available.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
