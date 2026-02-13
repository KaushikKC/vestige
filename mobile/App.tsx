import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { PrivyProvider } from "@privy-io/expo";
import { WalletProvider } from "./src/lib/use-wallet";
import RootNavigator from "./src/navigation/RootNavigator";

// TODO: Replace with your Privy App ID and Client ID from dashboard.privy.io
const PRIVY_APP_ID = "YOUR_PRIVY_APP_ID";
const PRIVY_CLIENT_ID = "YOUR_PRIVY_CLIENT_ID";

export default function App() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <WalletProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
          <Toast />
        </NavigationContainer>
      </WalletProvider>
    </PrivyProvider>
  );
}
