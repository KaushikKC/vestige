import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useComments, Comment } from '../lib/use-comments';
import { useWallet } from '../lib/use-wallet';

interface Props {
  launchPda: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncateWallet(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function CommentItem({ item }: { item: Comment }) {
  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentWallet}>{truncateWallet(item.wallet_address)}</Text>
        <Text style={styles.commentTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      <Text style={styles.commentContent}>{item.content}</Text>
    </View>
  );
}

export default function CommentThread({ launchPda }: Props) {
  const { comments, loading, postComment } = useComments(launchPda);
  const { publicKey, connected } = useWallet();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!connected || !publicKey || !text.trim()) return;
    setSending(true);
    try {
      await postComment(publicKey.toBase58(), text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COMMENTS</Text>
        <Text style={styles.headerCount}>{comments.length} comments</Text>
      </View>

      {/* Input bar */}
      <View style={styles.inputRow}>
        {connected ? (
          <>
            <TextInput
              style={styles.textInput}
              placeholder="Say something..."
              placeholderTextColor={COLORS.textTertiary}
              value={text}
              onChangeText={setText}
              maxLength={500}
              multiline={false}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.connectHint}>Connect wallet to comment</Text>
        )}
      </View>

      {/* Comment list */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : comments.length === 0 ? (
        <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CommentItem item={item} />}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.textTertiary,
  },
  headerCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111216',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  textInput: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    color: COLORS.text,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
    paddingVertical: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendBtnDisabled: {
    opacity: 0.2,
  },
  connectHint: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  commentCard: {
    backgroundColor: '#17181D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentWallet: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
  },
  commentTime: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  commentContent: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
