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
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';
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
              placeholderTextColor={COLORS.textMuted}
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
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
  },
  headerCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    paddingVertical: SPACING.xs + 2,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  connectHint: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  loadingWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  commentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.xs + 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  commentWallet: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.primary,
  },
  commentTime: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  commentContent: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
});
