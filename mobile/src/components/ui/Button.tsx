import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "default" | "outline" | "ghost" | "destructive";
type Size = "default" | "sm";

interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
}

const VARIANT_CONTAINER: Record<Variant, string> = {
  default: "bg-primary active:bg-blue-700",
  outline: "bg-white border border-slate-300 active:bg-slate-50",
  ghost: "bg-transparent active:bg-slate-100",
  destructive: "bg-red-600 active:bg-red-700",
};

const VARIANT_TEXT: Record<Variant, string> = {
  default: "text-white",
  outline: "text-slate-900",
  ghost: "text-slate-900",
  destructive: "text-white",
};

const SIZE_CONTAINER: Record<Size, string> = {
  default: "h-12 px-5",
  sm: "h-9 px-3",
};

const SIZE_TEXT: Record<Size, string> = {
  default: "text-base",
  sm: "text-sm",
};

export function Button({
  children,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  className,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl gap-2 ${SIZE_CONTAINER[size]} ${VARIANT_CONTAINER[variant]} ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      {...pressableProps}
    >
      {loading && <ActivityIndicator size="small" color={variant === "default" || variant === "destructive" ? "#fff" : "#0f172a"} />}
      <Text className={`font-semibold ${SIZE_TEXT[size]} ${VARIANT_TEXT[variant]}`}>{children}</Text>
    </Pressable>
  );
}
