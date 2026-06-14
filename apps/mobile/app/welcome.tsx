// apps/mobile/app/welcome.tsx
import { useRouter } from "expo-router";
import {
  Dimensions,
  Image,
  ImageBackground,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={["#ffffff", "#dde4ff", "#a0b0ff", "#1a2a8a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* ── LOGO ── */}
        <View style={styles.header}>
          <Image
            source={require("../assets/images/logo-reptel.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>
            Servicio técnico y tienda tecnológica
          </Text>
        </View>

        {/* ── MASCOTA ── */}
        <View style={styles.hero}>
          <Image
            source={require("../assets/images/mascota-reptel.png")}
            style={styles.mascot}
            resizeMode="contain"
          />
        </View>

        {/* ── PANEL ── */}
        <ImageBackground
          source={require("../assets/images/fondo-panel.png")}
          style={styles.panel}
          imageStyle={{
            opacity: 0.25,
            borderTopLeftRadius: 38,
            borderTopRightRadius: 38,
          }}
        >
          <LinearGradient
            colors={["#e8eeff", "#d0d8ff"]}
            style={styles.panelContent}
          >
            <Text style={styles.title}>¿Cómo deseas ingresar?</Text>

            {/* Botón Cliente — blanco semitransparente texto azul */}
            <TouchableOpacity
              style={styles.client}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/login?role=client")}
            >
              <View style={styles.btnCliente}>
                <Text style={styles.btnClienteTitle}>Soy Cliente</Text>
                <Text style={styles.btnClienteSub}>Compras y servicio técnico</Text>
              </View>
            </TouchableOpacity>

            {/* Botón Personal — blanco semitransparente texto violeta */}
            <TouchableOpacity
              style={styles.staff}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/login?role=staff")}
            >
              <View style={styles.btnPersonal}>
                <Text style={styles.btnPersonalTitle}>Soy Personal</Text>
                <Text style={styles.btnPersonalSub}>Acceso interno RepTel</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.version}>RepTel App v1.0</Text>
          </LinearGradient>
        </ImageBackground>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: StatusBar.currentHeight || 30,
  },

  // ── Header ──────────────────────────────────────────
  header: {
    width: "100%",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  logo: {
    width: width * 0.95,   // más grande
    height: 130,
  },
  subtitle: {
    color: "#2a2a6e",
    fontSize: 15,
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: "center",
    fontWeight: "500",
  },

  // ── Mascota ──────────────────────────────────────────
  hero: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  mascot: {
    width: width * 0.96,
    height: height * 0.46,
    zIndex: 2,
  },

  // ── Panel ────────────────────────────────────────────
  panel: {
    width: "100%",
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    overflow: "hidden",
  },
  panelContent: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 26,
    alignItems: "center",
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    gap: 14,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a6e",
    marginBottom: 4,
    textAlign: "center",
  },

  // Wrapper botón cliente
  client: {
    width: "100%",
    borderRadius: 20,
    shadowColor: "#1a1a6e",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // Wrapper botón personal
  staff: {
    width: "100%",
    borderRadius: 20,
    shadowColor: "#5a2a9a",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // Botón Cliente — blanco con borde azul sutil
  btnCliente: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(30,30,180,0.25)",
  },
  btnClienteTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a6e",
    letterSpacing: 0.3,
  },
  btnClienteSub: {
    fontSize: 13,
    color: "#3a3a9e",
    marginTop: 2,
  },

  // Botón Personal — blanco con borde violeta sutil
  btnPersonal: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(90,30,160,0.25)",
  },
  btnPersonalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#5a2a9a",
    letterSpacing: 0.3,
  },
  btnPersonalSub: {
    fontSize: 13,
    color: "#7a3aaa",
    marginTop: 2,
  },

  version: {
    marginTop: 4,
    color: "#6b6bcc",
    fontSize: 12,
  },
});