import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAppStore } from '../../store';
import { continueGoalConversation, generateRoadmap } from '../../services/ai/aiService';
import { ConversationMessage } from '../../types';

export default function GoalSetupScreen({ navigation }: any) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { conversation, addMessage, clearConversation } = useAppStore();
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);
  const [goalData, setGoalData] = useState<any>({});

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await continueGoalConversation(input.trim(), conversation);

      const aiMessage: ConversationMessage = {
        role: 'ai',
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      addMessage(aiMessage);

      if (response.readyToGenerate) {
        setIsReadyToGenerate(true);
      }
    } catch (error) {
      console.error('Error communicating with AI:', error);
      const errorMessage: ConversationMessage = {
        role: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    setIsLoading(true);
    
    try {
      // Extract goal information from conversation
      const firstUserMessage = conversation.find(m => m.role === 'user');
      
      if (!firstUserMessage) return;

      const result = await generateRoadmap({
        goal: firstUserMessage.content,
        timelineMonths: 6, // Default to 6 months, can be extracted from conversation
        context: {}, // Can be populated from conversation answers
      });

      // Navigate to home screen after successful roadmap generation
      clearConversation();
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error generating roadmap:', error);
      Alert.alert('Error', 'Failed to generate roadmap. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={styles.title}>What is your goal? 🎯</Text>
        <Text style={styles.subtitle}>
          Tell me what you want to achieve, and I'll help you create a personalized roadmap
        </Text>
      </View>

      <ScrollView style={styles.conversation} contentContainerStyle={styles.conversationContent}>
        {conversation.length === 0 && (
          <View style={styles.examplesContainer}>
            <Text style={styles.examplesTitle}>💡 Examples:</Text>
            <Text style={styles.example}>• Get promoted in 6 months</Text>
            <Text style={styles.example}>• Learn to code</Text>
            <Text style={styles.example}>• Run a marathon</Text>
            <Text style={styles.example}>• Start a business</Text>
          </View>
        )}

        {conversation.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={styles.messageRole}>
              {message.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
            </Text>
            <Text style={styles.messageText}>{message.content}</Text>
          </View>
        ))}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        {isReadyToGenerate ? (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateRoadmap}
            disabled={isLoading}
          >
            <Text style={styles.generateButtonText}>
              {isLoading ? 'Generating...' : '✨ Generate My Roadmap'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                conversation.length === 0
                  ? 'Type your goal here...'
                  : 'Type your answer...'
              }
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  conversation: {
    flex: 1,
  },
  conversationContent: {
    padding: 16,
  },
  examplesContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  example: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  messageBubble: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    color: '#666',
  },
  userBubbleMessageRole: {
    color: '#FFF',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#000',
  },
  userBubbleMessageText: {
    color: '#FFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
