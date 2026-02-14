// iOS App entry — uses Privy for wallet
// Android uses App.android.tsx instead (resolved by Metro automatically)
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { PrivyProvider } from "@privy-io/expo";
import { WalletProvider } from "./src/lib/use-wallet";
import RootNavigator from "./src/navigation/RootNavigator";

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";

export default function App() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <WalletProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
          <Toast />
        </NavigationContainer>
      </WalletProvider>
    </PrivyProvider>
  );
}
