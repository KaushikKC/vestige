import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface Comment {
  id: string;
  wallet_address: string;
  content: string;
  created_at: string;
}

export function useComments(launchPda: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, wallet_address, content, created_at')
      .eq('launch_pda', launchPda)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[Comments] fetch error:', error.message);
    } else if (data) {
      setComments(data);
    }
    setLoading(false);
  }, [launchPda]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${launchPda}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `launch_pda=eq.${launchPda}`,
        },
        (payload) => {
          const newComment = payload.new as Comment;
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [newComment, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [launchPda]);

  const postComment = useCallback(
    async (wallet: string, content: string) => {
      const trimmed = content.trim().slice(0, 500);
      if (!trimmed) return;

      const { data, error } = await supabase
        .from('comments')
        .insert({
          launch_pda: launchPda,
          wallet_address: wallet,
          content: trimmed,
        })
        .select('id, wallet_address, content, created_at')
        .single();

      if (error) {
        console.warn('[Comments] post error:', error.message);
      } else if (data) {
        setComments((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev;
          return [data, ...prev];
        });
      }
    },
    [launchPda]
  );

  return { comments, loading, postComment, refreshComments };
}
