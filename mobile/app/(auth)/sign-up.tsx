import { useState } from "react";
import { Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignUp } from "@clerk/clerk-expo";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Couldn't create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete — double-check the code.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "That code didn't work.");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <Screen scroll className="justify-center">
        <View className="gap-6 py-10">
          <View className="gap-1">
            <Text className="text-3xl font-bold text-slate-900">Check your email</Text>
            <Text className="text-base text-slate-500">Enter the verification code we just sent to {email}.</Text>
          </View>
          <View className="gap-4">
            <TextField
              label="Verification code"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              testID="input-verification-code"
            />
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            <Button onPress={onVerify} loading={submitting} disabled={!code}>
              Verify &amp; continue
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll className="justify-center">
      <View className="gap-6 py-10">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-slate-900">Create your account</Text>
          <Text className="text-base text-slate-500">Start pinning your favorite places.</Text>
        </View>

        <View className="gap-4">
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            testID="input-email"
          />
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            testID="input-password"
          />
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSubmit} loading={submitting} disabled={!email || !password}>
            Sign up
          </Button>
        </View>

        <View className="flex-row justify-center gap-1.5">
          <Text className="text-sm text-slate-500">Already have an account?</Text>
          <Link href="/(auth)/sign-in" className="text-sm font-semibold text-primary">
            Sign in
          </Link>
        </View>
      </View>
    </Screen>
  );
}
