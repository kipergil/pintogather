import { Text, TextInput, View, type TextInputProps } from "react-native";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, className, ...inputProps }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-sm font-medium text-slate-700">{label}</Text>}
      <TextInput
        placeholderTextColor="#94a3b8"
        className={`h-12 rounded-xl border px-4 text-base text-slate-900 ${error ? "border-red-400" : "border-slate-300"} ${className ?? ""}`}
        {...inputProps}
      />
      {error && <Text className="text-xs text-red-600">{error}</Text>}
    </View>
  );
}
