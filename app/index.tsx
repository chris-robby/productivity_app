import { Redirect } from 'expo-router';

// Routing is handled by _layout.tsx on boot.
// This file exists only as a fallback entry point.
export default function Index() {
  return <Redirect href="/auth/login" />;
}
