// Tipos do banco no formato gerado pelo Supabase CLI.
// Depois de alterar as migrations, regenere com: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; events_seen_at: string } & Timestamps;
        Insert: never;
        Update: { full_name?: string };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          instagram_handle: string | null;
          avatar_path: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          instagram_handle?: string | null;
          avatar_path?: string | null;
        };
        Update: {
          name?: string;
          instagram_handle?: string | null;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          owner_id: string;
          client_id: string;
          caption: string;
          status: Database["public"]["Enums"]["post_status"];
          scheduled_for: string | null;
          version: number;
          resubmitted_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          owner_id?: string;
          client_id: string;
          caption?: string;
          status?: Database["public"]["Enums"]["post_status"];
          scheduled_for?: string | null;
        };
        Update: {
          client_id?: string;
          caption?: string;
          status?: Database["public"]["Enums"]["post_status"];
          scheduled_for?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_client_id_owner_id_fkey";
            columns: ["client_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      post_slides: {
        Row: {
          id: string;
          owner_id: string;
          post_id: string;
          position: number;
          media_type: Database["public"]["Enums"]["media_type"];
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          post_id: string;
          position: number;
          media_type?: Database["public"]["Enums"]["media_type"];
          storage_path: string;
        };
        Update: {
          position?: number;
          media_type?: Database["public"]["Enums"]["media_type"];
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_slides_post_id_owner_id_fkey";
            columns: ["post_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      approval_links: {
        Row: {
          id: string;
          owner_id: string;
          client_id: string;
          token_hash: string;
          expires_at: string;
          revoked_at: string | null;
          last_accessed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          client_id: string;
          token_hash: string;
          expires_at: string;
        };
        Update: { revoked_at?: string | null };
        Relationships: [
          {
            foreignKeyName: "approval_links_client_id_owner_id_fkey";
            columns: ["client_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      approval_events: {
        Row: {
          id: string;
          owner_id: string;
          post_id: string;
          approval_link_id: string | null;
          action: Database["public"]["Enums"]["approval_action"];
          comment: string | null;
          audio_path: string | null;
          post_version: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "approval_events_post_id_owner_id_fkey";
            columns: ["post_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_post: {
        Args: {
          p_id: string;
          p_client_id: string;
          p_caption: string;
          p_scheduled_for: string | null;
          p_slides: Json;
        };
        Returns: Database["public"]["Tables"]["posts"]["Row"];
      };
      create_approval_link: {
        Args: { p_client_id: string; p_token_hash: string };
        Returns: Database["public"]["Tables"]["approval_links"]["Row"];
      };
      get_approval_page: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      update_post: {
        Args: {
          p_id: string;
          p_caption: string;
          p_scheduled_for: string | null;
          p_slides?: Json | null;
        };
        Returns: string[];
      };
      reschedule_post: {
        Args: { p_id: string; p_scheduled_for: string | null };
        Returns: Database["public"]["Tables"]["posts"]["Row"];
      };
      delete_post: {
        Args: { p_id: string };
        Returns: string[];
      };
      delete_client: {
        Args: { p_id: string };
        Returns: string[];
      };
      mark_events_seen: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_event_notification: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      get_audio_upload_folder: {
        Args: { p_token_hash: string; p_post_id: string };
        Returns: string;
      };
      register_approval: {
        Args: {
          p_token_hash: string;
          p_post_id: string;
          p_action: Database["public"]["Enums"]["approval_action"];
          p_comment?: string | null;
          p_audio_path?: string | null;
        };
        Returns: Database["public"]["Tables"]["approval_events"]["Row"];
      };
    };
    Enums: {
      post_status: "draft" | "pending_approval" | "approved" | "changes_requested";
      media_type: "image" | "video";
      approval_action: "approved" | "changes_requested";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
