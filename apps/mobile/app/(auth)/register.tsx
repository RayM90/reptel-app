import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
import { api } from "../../src/services/api";

const { width } = Dimensions.get("window");

const traducirErrorCognito = (mensaje: string): string => {
  if (mensaje.includes("already exists") || mensaje.includes("UsernameExistsException"))
    return "Ya existe una cuenta con ese correo electrónico";
  if (mensaje.includes("lowercase"))
    return "La contraseña debe contener al menos una letra minúscula";
  if (mensaje.includes("uppercase"))
    return "La contraseña debe contener al menos una letra mayúscula";
  if (mensaje.includes("numeric"))
    return "La contraseña debe contener al menos un número";
  if (mensaje.includes("symbol") || mensaje.includes("special"))
    return "La contraseña debe contener al menos un carácter especial (!@#$...)";
  if (mensaje.includes("long enough") || mensaje.includes("8 characters"))
    return "La contraseña debe tener al menos 8 caracteres";
  if (mensaje.includes("Invalid email"))
    return "El correo electrónico no es válido";
  if (mensaje.includes("Password did not conform"))
    return "La contraseña no cumple los requisitos: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo";
  return mensaje;
};

export default function RegisterScreen() {
  const [nombre,        setNombre]        = useState("");
  const [correo,        setCorreo]        = useState("");
  const [telefono,      setTelefono]      = useState("");
  const [direccion,     setDireccion]     = useState("");
  const [password,      setPassword]      = useState("");
  const [confirmar,     setConfirmar]     = useState("");
  const [loading,       setLoading]       = useState(false);
  const [verPassword,   setVerPassword]   = useState(false);
  const [verConfirmar,  setVerConfirmar]  = useState(false);

  const handleRegister = async () => {
    if (!nombre || !correo || !telefono || !direccion || !password || !confirmar) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }
    if (password !== confirmar) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "La contraseña debe tener al menos 8 caracteres");
      return;
    }

    try {
      setLoading(true);
      await api.post("/api/auth/register", {
        name:     nombre,
        email:    correo,
        phone:    telefono,
        address:  direccion,
        password,
        role:     "CLIENT",
      });

      Alert.alert(
        "¡Cuenta creada!",
        "Tu cuenta fue creada exitosamente. Ahora puedes iniciar sesión.",
        [{ text: "Iniciar sesión", onPress: () => router.replace("/(auth)/login?role=client") }]
      );
    } catch (error: any) {
      const mensajeRaw = error.response?.data?.message || "No se pudo crear la cuenta";
      Alert.alert("Error", traducirErrorCognito(mensajeRaw));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#ffffff", "#dde4ff", "#a0b0ff", "#1a2a8a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
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
              <Text style={styles.title}>Crear cuenta</Text>
              <Text style={styles.subtitle}>
                Regístrate para acceder a nuestros servicios
              </Text>
            </View>

            {/* Formulario */}
            <View style={styles.form}>

              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor="#9ca3af"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9ca3af"
                value={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                placeholder="0414-0000000"
                placeholderTextColor="#9ca3af"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              <Text style={styles.label}>Dirección completa</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Calle, Urbanización, Ciudad, Estado"
                placeholderTextColor="#9ca3af"
                value={direccion}
                onChangeText={setDireccion}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Contraseña con ojito */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!verPassword}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setVerPassword(!verPassword)}
                >
                  <Text style={styles.eyeIcon}>{verPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>

              {/* Confirmar contraseña con ojito */}
              <Text style={styles.label}>Confirmar contraseña</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Repite tu contraseña"
                  placeholderTextColor="#9ca3af"
                  value={confirmar}
                  onChangeText={setConfirmar}
                  secureTextEntry={!verConfirmar}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setVerConfirmar(!verConfirmar)}
                >
                  <Text style={styles.eyeIcon}>{verConfirmar ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>

              {/* Hint contraseña */}
              <Text style={styles.passwordHint}>
                La contraseña debe tener mayúscula, minúscula, número y símbolo (!@#$...)
              </Text>

              <TouchableOpacity
                style={[styles.btnRegister, loading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Crear cuenta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnLogin}
                onPress={() => router.replace("/(auth)/login?role=client")}
              >
                <Text style={styles.btnLoginText}>
                  ¿Ya tienes cuenta?{" "}
                  <Text style={styles.btnLoginLink}>Inicia sesión</Text>
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
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    marginBottom: 24,
  },
  logo: {
    width: width * 0.55,
    height: 65,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a6e",
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#4a4a8a",
    marginTop: 4,
    textAlign: "center",
  },
  form: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 24,
    padding: 22,
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
  inputMultiline: {
    height: 80,
    paddingTop: 12,
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
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
  },
  passwordHint: {
    fontSize: 11,
    color: "#7a7aaa",
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 16,
  },
  btnRegister: {
    backgroundColor: "#1a1a6e",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 22,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  btnLogin: {
    alignItems: "center",
    marginTop: 16,
  },
  btnLoginText: {
    fontSize: 13,
    color: "#4a4a8a",
  },
  btnLoginLink: {
    color: "#1a1a6e",
    fontWeight: "700",
  },
  backBtn: {
    alignItems: "center",
    marginTop: 20,
  },
  backText: {
    color: "#1a1a6e",
    fontSize: 14,
    fontWeight: "500",
  },
});