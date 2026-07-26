import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { PinStylePicker } from "@/components/ui/PinStylePicker";
import type { PinColor, PinIcon } from "../../../shared/enums";

export interface PinFormValue {
  userName: string;
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
  note: string;
  pinColor: PinColor | null;
  pinIcon: PinIcon | null;
}

interface PinFormProps {
  value: PinFormValue;
  onChange: (value: PinFormValue) => void;
  noteLabel: string;
  notePrompt: string | null;
  hasPinCustomization: boolean;
  /** Profile social handles to fill in with one tap — omitted/empty hides the "fill in my socials" checkbox. */
  profileSocials?: { twitterHandle: string; instagramHandle: string; linkedinHandle: string };
}

/** Add-pin and edit-pin field set shared between both screens — mirrors client/src/components/add-pin-modal.tsx's form. */
export function PinForm({ value, onChange, noteLabel, notePrompt, hasPinCustomization, profileSocials }: PinFormProps) {
  const [showSocialLinks, setShowSocialLinks] = useState(
    !!(value.twitterHandle || value.instagramHandle || value.linkedinHandle),
  );
  const [showPinStyle, setShowPinStyle] = useState(!!(value.pinColor || value.pinIcon));
  const [fillMySocials, setFillMySocials] = useState(false);

  const hasProfileSocials = !!(
    profileSocials &&
    (profileSocials.twitterHandle || profileSocials.instagramHandle || profileSocials.linkedinHandle)
  );

  const toggleFillMySocials = () => {
    const next = !fillMySocials;
    setFillMySocials(next);
    if (next && profileSocials) {
      onChange({ ...value, ...profileSocials });
      setShowSocialLinks(true);
    } else {
      onChange({ ...value, twitterHandle: "", instagramHandle: "", linkedinHandle: "" });
    }
  };

  return (
    <View className="gap-4">
      <TextField
        label="Your name"
        value={value.userName}
        onChangeText={(userName) => onChange({ ...value, userName })}
        placeholder="How should we credit this pin?"
        testID="input-user-name"
      />

      <TextField
        label={noteLabel}
        value={value.note}
        onChangeText={(note) => onChange({ ...value, note: note.slice(0, 280) })}
        placeholder={notePrompt || "What makes this place worth pinning?"}
        multiline
        numberOfLines={3}
        testID="input-pin-note"
      />
      {notePrompt && <Text className="-mt-2.5 text-xs text-slate-500">{notePrompt}</Text>}

      <View className="gap-3">
        <Button
          variant="ghost"
          className="justify-start px-0"
          onPress={() => setShowSocialLinks((v) => !v)}
          testID="button-toggle-social-links"
        >
          {`${showSocialLinks ? "▾" : "▸"}  Social links`}
        </Button>
        {showSocialLinks && (
          <View className="gap-3">
            {hasProfileSocials && (
              <Pressable className="flex-row items-center gap-2" onPress={toggleFillMySocials} testID="checkbox-fill-my-socials">
                <View className={`h-5 w-5 items-center justify-center rounded border ${fillMySocials ? "border-primary bg-primary" : "border-slate-300"}`}>
                  {fillMySocials && <Text className="text-xs font-bold text-white">✓</Text>}
                </View>
                <Text className="text-sm text-slate-600">Fill in my social links</Text>
              </Pressable>
            )}
            <TextField
              value={value.twitterHandle}
              onChangeText={(twitterHandle) => onChange({ ...value, twitterHandle })}
              placeholder="X (Twitter) handle or URL"
              autoCapitalize="none"
              testID="input-twitter"
            />
            <TextField
              value={value.instagramHandle}
              onChangeText={(instagramHandle) => onChange({ ...value, instagramHandle })}
              placeholder="Instagram handle or URL"
              autoCapitalize="none"
              testID="input-instagram"
            />
            <TextField
              value={value.linkedinHandle}
              onChangeText={(linkedinHandle) => onChange({ ...value, linkedinHandle })}
              placeholder="LinkedIn handle or URL"
              autoCapitalize="none"
              testID="input-linkedin"
            />
          </View>
        )}
      </View>

      {hasPinCustomization && (
        <View className="gap-3">
          <Button
            variant="ghost"
            className="justify-start px-0"
            onPress={() => setShowPinStyle((v) => !v)}
            testID="button-toggle-pin-style"
          >
            {`${showPinStyle ? "▾" : "▸"}  Pin color & icon`}
          </Button>
          {showPinStyle && (
            <PinStylePicker
              color={value.pinColor}
              icon={value.pinIcon}
              onChange={({ color, icon }) => onChange({ ...value, pinColor: color, pinIcon: icon })}
              noneLabel="Map default"
            />
          )}
        </View>
      )}
    </View>
  );
}
