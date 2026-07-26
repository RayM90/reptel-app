import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useToastStore } from '../../src/store/toast.store';
import { useConfirm } from '../../src/hooks/useConfirm';

export default function HomeClient() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);
  const confirmDialog = useConfirm();

  const firstName = user?.name?.split(' ')[0] ?? 'Cliente';

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
      id: 'store',
      emoji: '🛍️',
      label: 'Tienda',
      description: 'Accesorios y repuestos de alta calidad',
      route: '/(client)/store',
    },
    {
      id: 'service',
      emoji: '🔧',
      label: 'Servicio Técnico',
      description: 'Solicita tu reparación y hazle seguimiento',
      route: '/(client)/technical-service',
    },
  ];

const secondaryOptions = [
    {
      id: 'orders',
      emoji: '📦',
      label: 'Mis Pedidos',
      description: 'Historial de compras',
      route: '/(client)/my-orders',
    },
    {
      id: 'techOrders',
      emoji: '🛠️',
      label: 'Mis Órdenes',
      description: 'Servicio técnico',
      route: '/(client)/my-technical-orders',
    },
    {
      id: 'support',
      emoji: '💬',
      label: 'Soporte',
      description: 'WhatsApp activo',
      route: null,
    },
    {
      id: 'track',
      emoji: '🔍',
      label: 'Rastrear Orden',
      description: 'Consulta el estado por número',
      // TODO: pantalla pendiente de construir — usará GET /api/orders/track/:orderNumber
      route: null,
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleLogout}>
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
                style={styles.mainCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (option.route) {
                    router.push(option.route as any)
                  } else {
                    showToast('Esta función estará disponible pronto.', 'info')
                  }
                }}
              >
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
            {secondaryOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={styles.subCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (option.route) {
                  router.push(option.route as any)
                 } else {
                    showToast('Esta función estará disponible pronto.', 'info')
                 }
                }}
              >
                <View style={styles.subCardIconWrapper}>
                  <Text style={styles.subCardIcon}>{option.emoji}</Text>
                </View>
                <Text style={styles.cardLabel}>{option.label}</Text>
                <Text style={styles.cardDesc}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 4. ESTADO DEL SERVICIO */}
          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              Servicio técnico disponible · Lun–Sáb 8am–6pm
            </Text>
          </View>

        </ScrollView>
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
    justifyContent: 'flex-end',
    paddingTop: 30,
    paddingHorizontal: 22,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5364ad',
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
    color: '#5565ad',
    fontWeight: '500',
    textAlign: 'center',
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#17247a',
    marginTop: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#5364ad',
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
    backgroundColor: '#ffffff',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#17247a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  iconWrapper: {
    width: 54,
    height: 54,
    backgroundColor: '#eef2ff',
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
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#17247a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  subCardIconWrapper: {
    width: 46,
    height: 46,
    backgroundColor: '#eef2ff',
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
    color: '#17247a',
    marginBottom: 4,
  },
  cardDescLeft: {
    fontSize: 12,
    color: '#5364ad',
    lineHeight: 16,
  },
  cardDesc: {
    fontSize: 11,
    color: '#5364ad',
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
    backgroundColor: '#1E7A3D',
  },
  statusText: {
    fontSize: 12,
    color: '#5364ad',
    fontWeight: '500',
  },
});