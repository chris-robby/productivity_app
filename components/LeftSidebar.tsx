import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/colors';

const SIDEBAR_WIDTH = Math.min(Dimensions.get('window').width * 0.75, 300);

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Goal Overview', icon: 'flag-outline', route: '/goal-overview' },
  { label: 'Journey', icon: 'map-outline', route: '/journey' },
];

interface LeftSidebarProps {
  visible: boolean;
  onClose: () => void;
}

export function LeftSidebar({ visible, onClose }: LeftSidebarProps) {
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideAnim.setValue(-SIDEBAR_WIDTH);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 14,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function handleNav(route: string) {
    onClose();
    // Small delay so the drawer closes before the push animation starts
    setTimeout(() => router.push(route as any), 250);
  }

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Menu</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.navItem}
                onPress={() => handleNav(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={colors.primary}
                  style={styles.navIcon}
                />
                <Text style={styles.navLabel}>{item.label}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.placeholder}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: 'row',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    drawer: {
      width: SIDEBAR_WIDTH,
      height: '100%',
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 16,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    drawerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    navList: {
      paddingTop: 8,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navIcon: {
      marginRight: 14,
    },
    navLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
  });
}
