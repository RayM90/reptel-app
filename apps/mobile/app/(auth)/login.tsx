// apps/mobile/app/(auth)/login.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth.store";
import { useToastStore } from "../../src/store/toast.store";
import { api } from "../../src/services/api";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const { setUser } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast("Por favor completa todos los campos", "error");
      return;
    }
    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", { email, password });
      const { user, token, refreshToken } = response.data.data;
      setUser(user, token, refreshToken);

      router.replace("/(client)/home-client");
    } catch (error: any) {
      if (!error.response) {
        showToast(
          "No se pudo conectar al servidor. Verifica tu conexión e inténtalo de nuevo.",
          "error"
        );
      } else {
        showToast(
          error.response?.data?.message || "Credenciales incorrectas",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#ffffff", "#eef2ff", "#d5ddff", "#8fa5ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Image
                source={require("../../assets/images/logo-reptel.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.roleLabel}>Portal Cliente</Text>
              <Text style={styles.roleSubtitle}>
                Ingresa con tu cuenta para continuar
              </Text>
            </View>

            {/* Formulario */}
            <View style={styles.form}>

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              {/* Contraseña con ojito */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!verPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setVerPassword(!verPassword)}
                >
                  <Feather
                    name={verPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#8a8fc0"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnLogin,
                  loading && styles.btnDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Iniciar sesión</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnRegister}
                onPress={() => router.push("/(auth)/register")}
              >
                <Text style={styles.btnRegisterText}>
                  ¿No tienes cuenta?{" "}
                  <Text style={styles.btnRegisterLink}>Regístrate</Text>
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace("/welcome")}
            >
              <Text style={styles.backText}>← Volver al inicio</Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  safeArea: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 30,
  },

  keyboardView: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: width * 0.8,
    height: 100,
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a6e",
    letterSpacing: 0.4,
  },
  roleSubtitle: {
    fontSize: 13,
    color: "#4a4a8a",
    marginTop: 4,
    textAlign: "center",
  },

  // Formulario
  form: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#1a1a6e",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a6e",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#d0d8ff",
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: "#1a1a6e",
    backgroundColor: "#f0f4ff",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d0d8ff",
    borderRadius: 12,
    backgroundColor: "#f0f4ff",
    paddingRight: 8,
  },
  inputFlex: {
    flex: 1,
    padding: 13,
    fontSize: 15,
    color: "#1a1a6e",
  },
  eyeBtn: {
    padding: 12,
  },

  // Botón login
  btnLogin: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 22,
    backgroundColor: "#1a1a6e",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  btnRegister: {
    alignItems: "center",
    marginTop: 16,
  },
  btnRegisterText: {
    fontSize: 13,
    color: "#4a4a8a",
  },
  btnRegisterLink: {
    color: "#1a1a6e",
    fontWeight: "700",
  },

  backBtn: {
    alignItems: "center",
    marginTop: 24,
  },
  backText: {
    color: "#1a1a6e",
    fontSize: 14,
    fontWeight: "500",
  },
});