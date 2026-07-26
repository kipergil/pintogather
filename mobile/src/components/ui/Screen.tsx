import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, type ViewProps } from "react-native";

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  children: React.ReactNode;
}

/** Base screen wrapper: safe-area aware, optionally scrollable, consistent horizontal padding. */
export function Screen({ scroll = false, className, children, ...viewProps }: ScreenProps) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      <Container
        className={`flex-1 px-4 ${className ?? ""}`}
        {...(scroll ? { contentContainerClassName: "pb-8" } : {})}
        {...viewProps}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}
