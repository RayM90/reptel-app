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
      colors={["#ffffff", "#eef2ff", "#d5ddff", "#8fa5ff"]}
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
            <Text style={styles.title}>Bienvenido a RepTel</Text>

            {/* Botón Iniciar sesión */}
            <TouchableOpacity
              style={styles.client}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/login")}
            >
              <View style={styles.btnCliente}>
                <Text style={styles.btnClienteTitle}>Iniciar sesión</Text>
                <Text style={styles.btnClienteSub}>Ya tengo una cuenta</Text>
              </View>
            </TouchableOpacity>

            {/* Botón Crear cuenta */}
            <TouchableOpacity
              style={styles.staff}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/register")}
            >
              <View style={styles.btnPersonal}>
                <Text style={styles.btnPersonalTitle}>Crear cuenta</Text>
                <Text style={styles.btnPersonalSub}>Soy nuevo en RepTel</Text>
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
    width: width * 0.95,
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

  // Wrapper botón Iniciar sesión
  client: {
    width: "100%",
  },

  // Wrapper botón Crear cuenta
  staff: {
    width: "100%",
  },

  // Botón Iniciar sesión — borde sutil, sin fondo
  btnCliente: {
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(83,100,173,0.35)",
  },
  btnClienteTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#5364ad",
    letterSpacing: 0.3,
  },
  btnClienteSub: {
    fontSize: 13,
    color: "#5364ad",
    marginTop: 2,
  },

  // Botón Crear cuenta — borde sutil, sin fondo
  btnPersonal: {
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(83,100,173,0.35)",
  },
  btnPersonalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#5364ad",
    letterSpacing: 0.3,
  },
  btnPersonalSub: {
    fontSize: 13,
    color: "#5364ad",
    marginTop: 2,
  },

  version: {
    marginTop: 4,
    color: "#6b6bcc",
    fontSize: 12,
  },
});