// Android App entry — uses MWA for wallet, no Privy
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { WalletProvider } from "./src/lib/use-wallet";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
        <Toast />
      </NavigationContainer>
    </WalletProvider>
  );
}
