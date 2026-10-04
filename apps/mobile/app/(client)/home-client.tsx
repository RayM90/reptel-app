import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { useToastStore } from '../../src/store/toast.store';
import { useConfirm } from '../../src/hooks/useConfirm';
import { colors } from '../../src/theme/colors';
import { ordersAPI } from '../../src/services/api';
import { splitOrders } from '../../src/utils/orderGroups';
import { CLIENT_STATUS_LABEL } from '../../src/utils/orderProgress';
import SupportSheet from '../../src/components/SupportSheet';

interface ActiveOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  receivedAt: string;
  device: { brand: string; model: string };
}

export default function HomeClient() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);
  const confirmDialog = useConfirm();
  const insets = useSafeAreaInsets();

  const firstName = user?.name?.split(' ')[0] ?? 'Cliente';

  // Orden en curso más reciente, para la tarjeta "En curso".
  const [activeOrder, setActiveOrder] = useState<ActiveOrderSummary | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      ordersAPI
        .getMyOrders()
        .then((res) => setActiveOrder(splitOrders<ActiveOrderSummary>(res.data.data).active[0] ?? null))
        .catch(() => setActiveOrder(null));
    }, [])
  );

  const openActiveOrder = () => {
    if (activeOrder) {
      router.push({ pathname: '/(client)/my-technical-orders', params: { expandId: activeOrder.id } });
    } else {
      router.push('/(client)/my-technical-orders');
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas salir?',
      confirmLabel: 'Salir',
    });
    if (!confirmed) return;

    logout();
    router.replace('/welcome');
  };

  const primaryOptions = [
    {
      id: 'service',
      emoji: '🔧',
      label: 'Servicio Técnico',
      description: 'Solicita tu reparación y hazle seguimiento',
      route: '/(client)/technical-service',
      selected: true,
      soon: false,
    },
    {
      id: 'store',
      emoji: '🛍️',
      label: 'Tienda',
      description: 'Accesorios y repuestos de alta calidad',
      // TODO: tienda física en desarrollo — reactivar cuando exista el flujo de mostrador
      route: null,
      selected: false,
      soon: true,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']}
        style={styles.container}
      >
        {/* Barra superior con cerrar sesión */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.push('/(client)/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>👤 Mi perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Cerrar sesión →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* 1. HEADER */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo-reptel.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.greeting}>👋 ¡Hola,</Text>
            <Text style={styles.userName}>{firstName}</Text>
            <Text style={styles.subtitle}>¿Qué deseas hacer hoy?</Text>
          </View>

          {/* 2. TARJETAS PRINCIPALES */}
          <View style={styles.primaryContainer}>
            {primaryOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[styles.mainCard, option.selected && styles.selectedCard]}
                activeOpacity={0.85}
                onPress={() => {
                  if (option.route) {
                    router.push(option.route as any)
                  } else {
                    showToast('Esta función estará disponible pronto.', 'info')
                  }
                }}
              >
                {option.soon && <Text style={[styles.soonTag, styles.soonTagCorner]}>PRÓXIMAMENTE</Text>}
                <View style={styles.iconWrapper}>
                  <Text style={styles.mainCardIcon}>{option.emoji}</Text>
                </View>
                <View style={styles.mainCardTextContainer}>
                  <Text style={styles.cardLabel}>{option.label}</Text>
                  <Text style={styles.cardDescLeft}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 3. TARJETAS SECUNDARIAS */}
          <View style={styles.secondaryRow}>
            {/* En curso: la orden activa más reciente */}
            <TouchableOpacity style={[styles.subCard, styles.activeCard]} activeOpacity={0.85} onPress={openActiveOrder}>
              <View style={styles.activeHeader}>
                <View style={styles.statusDot} />
                <Text style={styles.activeLabel}>EN CURSO</Text>
              </View>
              {activeOrder ? (
                <>
                  <Text style={styles.cardLabel}>{activeOrder.orderNumber}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {activeOrder.device.brand} {activeOrder.device.model} ·{' '}
                    {(CLIENT_STATUS_LABEL[activeOrder.status] ?? '').replace(/^\S+\s/, '')}
                  </Text>
                </>
              ) : (
                <Text style={styles.cardDesc}>Sin órdenes en curso</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subCard, styles.selectedCard]}
              activeOpacity={0.85}
              onPress={() => router.push('/(client)/my-technical-orders')}
            >
              <View style={styles.subCardIconWrapper}>
                <Text style={styles.subCardIcon}>🛠️</Text>
              </View>
              <Text style={styles.cardLabel}>Mis Órdenes</Text>
              <Text style={styles.cardDesc}>Servicio técnico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.subCard} activeOpacity={0.85} onPress={() => setSupportOpen(true)}>
              <View style={styles.subCardIconWrapper}>
                <Text style={styles.subCardIcon}>💬</Text>
              </View>
              <Text style={styles.cardLabel}>Soporte</Text>
              <Text style={styles.cardDesc}>Atención al cliente</Text>
            </TouchableOpacity>

            {/* TODO: pantalla pendiente de construir — usará GET /api/orders/track/:orderNumber */}
            <TouchableOpacity
              style={styles.subCard}
              activeOpacity={0.85}
              onPress={() => showToast('Esta función estará disponible pronto.', 'info')}
            >
              <Text style={[styles.soonTag, { marginBottom: 8 }]}>PRÓXIMAMENTE</Text>
              <Text style={styles.cardLabel}>Rastrear Orden</Text>
              <Text style={styles.cardDesc}>Consulta el estado por número</Text>
            </TouchableOpacity>
          </View>

          {/* 4. ESTADO DEL SERVICIO */}
          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              Servicio técnico disponible · Lun–Sáb 8am–6pm
            </Text>
          </View>

        </ScrollView>

        <SupportSheet visible={supportOpen} onClose={() => setSupportOpen(false)} />
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  logoutBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 4,
  },
  logo: {
    width: 220,
    height: 70,
    marginBottom: 8,  
    marginTop: -10,    
    alignSelf: 'center',
    transform: [
      { scale: 1.9 },    
      { translateX: -4 } 
    ],
  },
  greeting: {
    fontSize: 16,
    color: colors.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '400',
  },
  primaryContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 20,
  },
  mainCard: {
    width: '100%',
    height: 90,
    backgroundColor: colors.surface,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  iconWrapper: {
    width: 54,
    height: 54,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mainCardIcon: {
    fontSize: 26,
  },
  mainCardTextContainer: {
    flex: 1,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  subCard: {
    width: '47%',
    height: 130,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  activeCard: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.4,
  },
  soonTag: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.secondary,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    letterSpacing: 0.3,
  },
  soonTagCorner: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
  subCardIconWrapper: {
    width: 46,
    height: 46,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  subCardIcon: {
    fontSize: 22,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  cardDescLeft: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
});