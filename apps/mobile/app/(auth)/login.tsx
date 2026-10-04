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
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth.store";
import { useToastStore } from "../../src/store/toast.store";
import { api, authAPI } from "../../src/services/api";

// Igual que el SafeAreaView de react-native (obsoleto): solo en iOS se
// respeta el área segura; en Android el diseño ya deja su propio margen.
const SAFE_EDGES = Platform.OS === "ios" ? (["top", "bottom"] as const) : ([] as const);

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const { setUser } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  // Challenge NEW_PASSWORD_REQUIRED (admin le puso una contraseña temporal
  // vía "olvidé mi contraseña" o al crear la cuenta) — Cognito exige que el
  // usuario establezca su propia contraseña definitiva antes de continuar.
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [session, setSession] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [verNewPassword, setVerNewPassword] = useState(false);

  // "¿Olvidaste tu contraseña?" — Cognito envía un código al correo del
  // cliente; con él y la nueva clave se completa el cambio sin el admin.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "code">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [verForgotPassword, setVerForgotPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // r•••@gmail.com — para confirmar a dónde se envió el código.
  const maskedEmail = forgotEmail.trim().replace(/^(.)[^@]*(@.*)$/, "$1•••$2");

  const resetForgot = () => {
    setShowForgotPassword(false);
    setForgotStep("email");
    setForgotCode("");
    setForgotNewPassword("");
    setForgotConfirm("");
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast("Por favor completa todos los campos", "error");
      return;
    }
    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", { email, password });
      const data = response.data.data;

      if (data.challengeName === "NEW_PASSWORD_REQUIRED") {
        setSession(data.session);
        setRequiresNewPassword(true);
        setLoading(false);
        return;
      }

      const { user, token, refreshToken } = data;
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

  const handleNewPasswordSubmit = async () => {
    if (!newPassword || !confirmNewPassword) {
      showToast("Por favor completa los dos campos", "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres", "error");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/auth/complete-new-password", {
        email,
        newPassword,
        session,
      });
      const { user, token, refreshToken } = response.data.data;
      setUser(user, token, refreshToken);

      router.replace("/(client)/home-client");
    } catch (error: any) {
      showToast(
        error.response?.data?.message || "Error al establecer la nueva contraseña",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotEmail.trim()) {
      showToast("Por favor ingresa tu correo", "error");
      return;
    }
    try {
      setForgotLoading(true);
      await authAPI.forgotPassword(forgotEmail.trim());
      setForgotStep("code");
    } catch (error: any) {
      showToast(error?.response?.data?.message || "No se pudo enviar el código. Intenta de nuevo más tarde.", "error");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmForgotPassword = async () => {
    if (!/^\d{6}$/.test(forgotCode)) {
      showToast("El código tiene 6 números", "error");
      return;
    }
    if (forgotNewPassword.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres", "error");
      return;
    }
    if (forgotNewPassword !== forgotConfirm) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    try {
      setForgotLoading(true);
      await authAPI.confirmForgotPassword(forgotEmail.trim(), forgotCode, forgotNewPassword);
      showToast("✅ Contraseña actualizada. Ya puedes iniciar sesión.", "success");
      setEmail(forgotEmail.trim());
      resetForgot();
    } catch (error: any) {
      showToast(error?.response?.data?.message || "No se pudo cambiar la contraseña", "error");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#ffffff", "#eef2ff", "#d5ddff", "#8fa5ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={SAFE_EDGES}>
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
              <Text style={styles.roleLabel}>
                {requiresNewPassword
                  ? "Nueva contraseña"
                  : showForgotPassword
                  ? "Recuperar contraseña"
                  : "Portal Cliente"}
              </Text>
              <Text style={styles.roleSubtitle}>
                {requiresNewPassword
                  ? "Debes establecer una nueva contraseña para continuar"
                  : showForgotPassword
                  ? forgotStep === "email"
                    ? "Te enviaremos un código a tu correo"
                    : "Escribe el código que llegó a tu correo"
                  : "Ingresa con tu cuenta para continuar"}
              </Text>
            </View>

            {/* Formulario */}
            <View style={styles.form}>
              {requiresNewPassword ? (
                <>
                  <Text style={styles.label}>Nueva contraseña</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!verNewPassword}
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setVerNewPassword(!verNewPassword)}
                    >
                      <Feather
                        name={verNewPassword ? "eye-off" : "eye"}
                        size={20}
                        color="#8a8fc0"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Confirmar nueva contraseña</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry={!verNewPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleNewPasswordSubmit}
                  />

                  <TouchableOpacity
                    style={[styles.btnLogin, loading && styles.btnDisabled]}
                    onPress={handleNewPasswordSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Establecer contraseña</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : showForgotPassword ? (
                <>
                  {forgotStep === "email" ? (
                    <>
                      <Text style={styles.label}>Correo electrónico</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="correo@ejemplo.com"
                        placeholderTextColor="#9ca3af"
                        value={forgotEmail}
                        onChangeText={setForgotEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleForgotPasswordSubmit}
                      />

                      <TouchableOpacity
                        style={[styles.btnLogin, forgotLoading && styles.btnDisabled]}
                        onPress={handleForgotPasswordSubmit}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.btnText}>Enviar código</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.successText}>
                        ✓ Te enviamos un código a {maskedEmail}. Revisa también la carpeta de spam.
                      </Text>

                      <Text style={styles.label}>Código de 6 números</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="123456"
                        placeholderTextColor="#9ca3af"
                        value={forgotCode}
                        onChangeText={(text) => setForgotCode(text.replace(/\D/g, "").slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                      />

                      <Text style={styles.label}>Nueva contraseña</Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.inputFlex}
                          placeholder="Mínimo 8 caracteres"
                          placeholderTextColor="#9ca3af"
                          value={forgotNewPassword}
                          onChangeText={setForgotNewPassword}
                          secureTextEntry={!verForgotPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setVerForgotPassword(!verForgotPassword)}>
                          <Feather name={verForgotPassword ? "eye-off" : "eye"} size={20} color="#8a8fc0" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.label}>Confirmar contraseña</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Repite tu contraseña"
                        placeholderTextColor="#9ca3af"
                        value={forgotConfirm}
                        onChangeText={setForgotConfirm}
                        secureTextEntry={!verForgotPassword}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleConfirmForgotPassword}
                      />

                      <TouchableOpacity
                        style={[styles.btnLogin, forgotLoading && styles.btnDisabled]}
                        onPress={handleConfirmForgotPassword}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.btnText}>Cambiar contraseña</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.btnRegister} onPress={handleForgotPasswordSubmit} disabled={forgotLoading}>
                        <Text style={styles.btnRegisterText}>
                          <Text style={styles.btnRegisterLink}>Reenviar código</Text>
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity style={styles.btnRegister} onPress={resetForgot}>
                    <Text style={styles.btnRegisterText}>
                      <Text style={styles.btnRegisterLink}>← Volver al inicio de sesión</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
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
                      autoCapitalize="none"
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

                  <TouchableOpacity
                    style={styles.btnRegister}
                    onPress={() => setShowForgotPassword(true)}
                  >
                    <Text style={styles.btnRegisterText}>
                      <Text style={styles.btnRegisterLink}>¿Olvidaste tu contraseña?</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {!requiresNewPassword && !showForgotPassword && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.replace("/welcome")}
              >
                <Text style={styles.backText}>← Volver al inicio</Text>
              </TouchableOpacity>
            )}

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

  successText: {
    fontSize: 14,
    color: "#166534",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
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