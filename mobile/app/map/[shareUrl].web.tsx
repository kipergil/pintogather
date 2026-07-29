import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "@/components/ShareSheet";
import { PinForm, type PinFormValue } from "@/components/PinForm";
import { AddItemForm, type ItemFormValue } from "@/components/AddItemForm";
import {
  VenueSearchSheet,
  type VenueResult,
} from "@/components/VenueSearchSheet";
import { useAddPin, useMap } from "@/hooks/useMaps";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PIN_COLOR_HEX, resolvePinStyle } from "@/lib/pin-styles";
import { signInHref } from "@/lib/authNav";

const EMPTY_PIN_FORM: PinFormValue = {
  title: "",
  contributorName: "",
  twitterHandle: "",
  instagramHandle: "",
  linkedinHandle: "",
  note: "",
  photoUrl: null,
  pinColor: null,
  pinIcon: null,
};

const EMPTY_ITEM_FORM: ItemFormValue = {
  title: "",
  contributorName: "",
  url: "",
  note: "",
  photoUrl: null,
};

/**
 * react-native-maps has no web implementation (it registers a native Fabric
 * component that doesn't exist in react-native-web, which would otherwise
 * crash Expo Router's route registration for the whole app on web). Metro
 * picks this file over [shareUrl].tsx automatically when bundling for web
 * — iOS/Android still get the real MapView screen, unaffected. This is a
 * plain-list fallback so the web preview target stays useful for
 * development instead of unusable; it isn't meant to be a shipped web
 * experience.
 */
export default function MapDetailWebFallback() {
  const { isSignedIn } = useAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { data: currentUser } = useCurrentUser();
  const { data: map, isLoading, error } = useMap(shareUrl);
  const addPin = useAddPin(shareUrl);
  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [venueSearchVisible, setVenueSearchVisible] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<VenueResult | null>(null);
  const [pinForm, setPinForm] = useState<PinFormValue>(EMPTY_PIN_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [itemSheetVisible, setItemSheetVisible] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormValue>(EMPTY_ITEM_FORM);
  const [itemSubmitError, setItemSubmitError] = useState<string | null>(null);

  const onVenueSelected = (place: VenueResult) => {
    setVenueSearchVisible(false);
    setPendingPlace(place);
    setPinForm({ ...EMPTY_PIN_FORM, title: place.name });
    setSubmitError(null);
  };

  const closeAddPinModal = () => {
    setPendingPlace(null);
    setSubmitError(null);
  };

  const onSubmitPin = async () => {
    if (!pendingPlace) return;
    if (!pinForm.title.trim()) {
      setSubmitError("Please enter a title for this pin.");
      return;
    }
    if (!isSignedIn && !pinForm.contributorName.trim()) {
      setSubmitError("Please enter your name so we know who added this pin.");
      return;
    }
    setSubmitError(null);
    try {
      const pin = await addPin.mutateAsync({
        title: pinForm.title.trim(),
        contributorName: isSignedIn
          ? null
          : pinForm.contributorName.trim() || null,
        latitude: pendingPlace.latitude,
        longitude: pendingPlace.longitude,
        address: pendingPlace.address,
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
        Alert.alert(
          "Pin added",
          "Your pin is pending the map owner's approval before it's visible to others.",
        );
      }
    } catch (err: any) {
      setSubmitError(err?.message ?? "Couldn't add that pin.");
    }
  };

  const openAddItemSheet = () => {
    setItemForm(EMPTY_ITEM_FORM);
    setItemSubmitError(null);
    setItemSheetVisible(true);
  };

  const closeAddItemSheet = () => {
    setItemSheetVisible(false);
    setItemSubmitError(null);
  };

  const onSubmitItem = async () => {
    if (!itemForm.title.trim()) {
      setItemSubmitError("Please enter a title for this item.");
      return;
    }
    if (!isSignedIn && !itemForm.contributorName.trim()) {
      setItemSubmitError("Please enter your name so we know who added this.");
      return;
    }
    if (map?.itemType === "link" && !itemForm.url.trim()) {
      setItemSubmitError("Please paste a link for this item.");
      return;
    }
    setItemSubmitError(null);
    try {
      const pin = await addPin.mutateAsync({
        title: itemForm.title.trim(),
        contributorName: isSignedIn
          ? null
          : itemForm.contributorName.trim() || null,
        url: itemForm.url.trim() || null,
        note: itemForm.note.trim() || undefined,
        photoUrl: itemForm.photoUrl,
      });
      closeAddItemSheet();
      const label = map?.itemType === "link" ? "link" : "recommendation";
      if (!pin.approved) {
        Alert.alert(
          `${label === "link" ? "Link" : "Recommendation"} added`,
          `Your ${label} is pending the map owner's approval before it's visible to others.`,
        );
      }
    } catch (err: any) {
      setItemSubmitError(err?.message ?? "Couldn't add that item.");
    }
  };

  return (
    <View className="flex-1 bg-slate-50 px-4">
      <Stack.Screen
        options={{
          title: map?.name ?? "Map",
          headerRight: () => (
            <View className="flex-row items-center gap-4">
              <Pressable
                hitSlop={8}
                onPress={() => setShareSheetVisible(true)}
                testID="button-share-map"
              >
                <Ionicons name="share-outline" size={22} color="#2563EB" />
              </Pressable>
              {isOwner && (
                <Link href={`/map/edit/${shareUrl}`} asChild>
                  <Pressable hitSlop={8} testID="button-edit-map">
                    <Ionicons
                      name="settings-outline"
                      size={22}
                      color="#2563EB"
                    />
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
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load this map"
        />
      ) : (
        <>
          <View className="gap-1 py-4">
            <Text className="text-xl font-bold text-slate-900">{map.name}</Text>
            <Text className="text-sm text-amber-600">
              The map view is only available in the iOS/Android app — open this
              project on a device or simulator to see pins on a real map.
              Showing the pin list here instead.
            </Text>
            {!isSignedIn && (
              <Text className="text-xs text-amber-700" testID="guest-notice">
                Viewing as a guest.{" "}
                <Link
                  href={signInHref(`/map/${shareUrl}`)}
                  className="font-semibold underline"
                >
                  Sign in
                </Link>{" "}
                to manage your own maps.
              </Text>
            )}
            {map.itemType === "location" ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setVenueSearchVisible(true)}
                testID="button-search-venue"
              >
                Search for a venue to add
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onPress={openAddItemSheet}
                testID="button-add-item"
              >
                {`Add ${map.itemType === "link" ? "link" : "recommendation"}`}
              </Button>
            )}
          </View>
          <FlatList
            data={map.pins}
            keyExtractor={(pin) => pin.id}
            renderItem={({ item: pin }) => {
              const style = map
                ? resolvePinStyle(pin, map)
                : { color: null, icon: null };
              const hex = style.color ? PIN_COLOR_HEX[style.color] : "#3B82F6";
              const canModify =
                isOwner || (!!currentUser && currentUser.id === pin.userId);
              return (
                <View className="mb-2 flex-row items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                  {map.itemType === "location" && (
                    <View
                      className="mt-1 h-3 w-3 rounded-full"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <View className="flex-1">
                    <Text className="font-semibold text-slate-900">
                      {pin.title}
                    </Text>
                    {pin.note && (
                      <Text className="text-sm text-slate-600">{pin.note}</Text>
                    )}
                    {pin.address && (
                      <Text className="text-xs text-slate-400">
                        {pin.address}
                      </Text>
                    )}
                    {pin.url && (
                      <Text className="text-xs text-primary">{pin.url}</Text>
                    )}
                    {!pin.approved && (
                      <Text className="text-xs font-medium text-amber-600">
                        Pending approval
                      </Text>
                    )}
                  </View>
                  {canModify && (
                    <Link href={`/map/edit-pin/${shareUrl}/${pin.id}`} asChild>
                      <Pressable
                        hitSlop={8}
                        testID={`button-edit-pin-${pin.id}`}
                      >
                        <Ionicons name="pencil" size={16} color="#64748b" />
                      </Pressable>
                    </Link>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState icon="location-outline" title="No pins yet" />
            }
          />
        </>
      )}

      {map && (
        <ShareSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          mapName={map.name}
          shareUrl={shareUrl}
        />
      )}

      <VenueSearchSheet
        visible={venueSearchVisible}
        onClose={() => setVenueSearchVisible(false)}
        onSelect={onVenueSelected}
      />

      <Modal
        visible={!!pendingPlace}
        animationType="slide"
        transparent
        onRequestClose={closeAddPinModal}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[85%] rounded-t-3xl bg-white p-6">
            <Text className="text-lg font-bold text-slate-900">Add a pin</Text>
            {pendingPlace && (
              <Text className="mb-4 mt-0.5 text-xs text-slate-500">
                {pendingPlace.address}
              </Text>
            )}
            <ScrollView>
              <PinForm
                value={pinForm}
                onChange={setPinForm}
                noteLabel={map?.noteLabel || "Note"}
                notePrompt={map?.notePrompt ?? null}
                hasPinCustomization={!!map?.hasPinCustomization}
                showContributorName={!isSignedIn}
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
            {submitError && (
              <Text className="mt-3 text-sm text-red-600">{submitError}</Text>
            )}
            <View className="mt-4 flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={closeAddPinModal}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={addPin.isPending}
                onPress={onSubmitPin}
                testID="button-submit-pin"
              >
                Drop pin
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
