import { useState } from "react";
import { Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Additional verification is required — this isn't yet handled by this boilerplate.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Couldn't sign in — check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll className="justify-center">
      <View className="gap-6 py-10">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-slate-900">Welcome back</Text>
          <Text className="text-base text-slate-500">Sign in to see your maps.</Text>
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
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            testID="input-password"
          />
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSubmit} loading={submitting} disabled={!email || !password}>
            Sign in
          </Button>
        </View>

        <View className="flex-row justify-center gap-1.5">
          <Text className="text-sm text-slate-500">Don't have an account?</Text>
          <Link href="/(auth)/sign-up" className="text-sm font-semibold text-primary">
            Sign up
          </Link>
        </View>
      </View>
    </Screen>
  );
}
