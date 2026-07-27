import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Callout, Marker, type LatLng } from "react-native-maps";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinForm, type PinFormValue } from "@/components/PinForm";
import { ShareSheet } from "@/components/ShareSheet";
import { useAddPin, useDeletePin, useMap } from "@/hooks/useMaps";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PIN_COLOR_HEX, PIN_ICON_IONICON, resolvePinStyle } from "@/lib/pin-styles";
import { signInHref } from "@/lib/authNav";
import { VenueSearchSheet, type VenueResult } from "@/components/VenueSearchSheet";
import type { Pin } from "../../../shared/schema";

// Central London — same fallback the web app's map component uses when a
// map has no pins yet to derive a center from (client/src/components/simple-google-map.tsx).
const DEFAULT_REGION = { latitude: 51.5074, longitude: -0.1278 };

const EMPTY_PIN_FORM: PinFormValue = {
  userName: "",
  twitterHandle: "",
  instagramHandle: "",
  linkedinHandle: "",
  note: "",
  pinColor: null,
  pinIcon: null,
};

export default function MapDetailScreen() {
  const { isSignedIn } = useAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();
  const { data: map, isLoading, error } = useMap(shareUrl);
  const addPin = useAddPin(shareUrl);
  const deletePin = useDeletePin(shareUrl);
  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;

  const [pendingCoordinate, setPendingCoordinate] = useState<LatLng | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [pinForm, setPinForm] = useState<PinFormValue>(EMPTY_PIN_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [venueSearchVisible, setVenueSearchVisible] = useState(false);
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(() => {
    const firstPin = map?.pins[0];
    const center = firstPin
      ? { latitude: Number(firstPin.latitude), longitude: Number(firstPin.longitude) }
      : DEFAULT_REGION;
    return { ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [map?.pins]);

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
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              <Pressable hitSlop={8} onPress={() => setShareSheetVisible(true)} testID="button-share-map">
                <Ionicons name="share-outline" size={22} color="#2563EB" />
              </Pressable>
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
          <MapView
            ref={mapRef}
            className="flex-1"
            initialRegion={initialRegion}
            onPress={(e) => openAddPinModal(e.nativeEvent.coordinate)}
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
          </MapView>

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
            onPress={() => setVenueSearchVisible(true)}
            className="absolute bottom-24 left-4 h-11 w-11 items-center justify-center rounded-full bg-white shadow"
            testID="button-search-venue"
          >
            <Ionicons name="search-outline" size={20} color="#2563EB" />
          </Pressable>

          <View className="absolute bottom-6 left-4 right-4 flex-row items-center justify-between rounded-2xl bg-white/95 px-4 py-3 shadow">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="location" size={16} color="#2563EB" />
              <Text className="text-sm font-medium text-slate-700">
                {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
              </Text>
            </View>
            <Text className="text-xs text-slate-400">Tap the map or search to add a pin</Text>
          </View>
        </>
      )}

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
    </View>
  );
}
