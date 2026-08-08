export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_records: {
        Row: {
          created_at: string
          degree: string | null
          display_order: number
          end_date: string | null
          id: string
          level: string
          major: string | null
          owner_visible: boolean
          profile_id: string
          school_name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          level: string
          major?: string | null
          owner_visible?: boolean
          profile_id: string
          school_name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          level?: string
          major?: string | null
          owner_visible?: boolean
          profile_id?: string
          school_name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          id: string
          memo: string | null
          target_license_id: string | null
          target_profile_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          id?: string
          memo?: string | null
          target_license_id?: string | null
          target_profile_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          memo?: string | null
          target_license_id?: string | null
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_actions_target_license_id_fkey"
            columns: ["target_license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_by: string | null
          granted_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_by?: string | null
          granted_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_by?: string | null
          granted_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      educations: {
        Row: {
          completion_date: string | null
          created_at: string
          description: string | null
          display_order: number
          education_name: string
          id: string
          organization_name: string | null
          owner_visible: boolean
          profile_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          education_name: string
          id?: string
          organization_name?: string | null
          owner_visible?: boolean
          profile_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          education_name?: string
          id?: string
          organization_name?: string | null
          owner_visible?: boolean
          profile_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "educations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "educations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          end_date: string | null
          id: string
          is_current: boolean
          organization_name: string
          owner_visible: boolean
          period_visible: boolean
          position: string | null
          profile_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          is_current?: boolean
          organization_name: string
          owner_visible?: boolean
          period_visible?: boolean
          position?: string | null
          profile_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          is_current?: boolean
          organization_name?: string
          owner_visible?: boolean
          period_visible?: boolean
          position?: string | null
          profile_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          acquired_date: string | null
          category: string | null
          created_at: string
          document_path_private: string | null
          id: string
          is_public: boolean
          issuing_organization: string | null
          license_name: string
          license_number_encrypted: string | null
          owner_visible: boolean
          profile_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          acquired_date?: string | null
          category?: string | null
          created_at?: string
          document_path_private?: string | null
          id?: string
          is_public?: boolean
          issuing_organization?: string | null
          license_name: string
          license_number_encrypted?: string | null
          owner_visible?: boolean
          profile_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          acquired_date?: string | null
          category?: string | null
          created_at?: string
          document_path_private?: string | null
          id?: string
          is_public?: boolean
          issuing_organization?: string | null
          license_name?: string
          license_number_encrypted?: string | null
          owner_visible?: boolean
          profile_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      professions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profile_gallery_images: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          image_path: string
          owner_visible: boolean
          profile_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_path: string
          owner_visible?: boolean
          profile_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_path?: string
          owner_visible?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_gallery_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_gallery_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_gallery_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_professions: {
        Row: {
          created_at: string
          custom_label: string | null
          display_order: number
          is_primary: boolean
          owner_visible: boolean
          profession_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          display_order?: number
          is_primary?: boolean
          owner_visible?: boolean
          profession_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          display_order?: number
          is_primary?: boolean
          owner_visible?: boolean
          profession_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_professions_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_professions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_professions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_professions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_specialties: {
        Row: {
          created_at: string
          display_order: number
          is_primary: boolean
          owner_visible: boolean
          profile_id: string
          specialty_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          owner_visible?: boolean
          profile_id: string
          specialty_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          owner_visible?: boolean
          profile_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_specialties_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_specialties_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_specialties_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          blog_url: string | null
          cover_image_path: string | null
          created_at: string
          deletion_requested_at: string | null
          display_name: string | null
          experience_period_visible: boolean
          headline: string | null
          id: string
          instagram_url: string | null
          introduction: string | null
          is_public: boolean
          kakao_url: string | null
          owner_visible: boolean
          profile_image_path: string | null
          region: string | null
          submitted_at: string | null
          terms_agreed_at: string | null
          threads_url: string | null
          updated_at: string
          user_id: string
          verification_status: string
          youtube_url: string | null
        }
        Insert: {
          approved_at?: string | null
          blog_url?: string | null
          cover_image_path?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          experience_period_visible?: boolean
          headline?: string | null
          id?: string
          instagram_url?: string | null
          introduction?: string | null
          is_public?: boolean
          kakao_url?: string | null
          owner_visible?: boolean
          profile_image_path?: string | null
          region?: string | null
          submitted_at?: string | null
          terms_agreed_at?: string | null
          threads_url?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
          youtube_url?: string | null
        }
        Update: {
          approved_at?: string | null
          blog_url?: string | null
          cover_image_path?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          experience_period_visible?: boolean
          headline?: string | null
          id?: string
          instagram_url?: string | null
          introduction?: string | null
          is_public?: boolean
          kakao_url?: string | null
          owner_visible?: boolean
          profile_image_path?: string | null
          region?: string | null
          submitted_at?: string | null
          terms_agreed_at?: string | null
          threads_url?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      share_events: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          referrer_domain: string | null
          share_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          referrer_domain?: string | null
          share_type: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          referrer_domain?: string | null
          share_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      workplaces: {
        Row: {
          address: string | null
          address_detail: string | null
          center_name: string
          created_at: string
          external_contact_url: string | null
          id: string
          is_current: boolean
          is_location_public: boolean
          latitude: number | null
          longitude: number | null
          owner_visible: boolean
          phone: string | null
          profile_id: string
          region: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          center_name: string
          created_at?: string
          external_contact_url?: string | null
          id?: string
          is_current?: boolean
          is_location_public?: boolean
          latitude?: number | null
          longitude?: number | null
          owner_visible?: boolean
          phone?: string | null
          profile_id: string
          region?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          center_name?: string
          created_at?: string
          external_contact_url?: string | null
          id?: string
          is_current?: boolean
          is_location_public?: boolean
          latitude?: number | null
          longitude?: number | null
          owner_visible?: boolean
          phone?: string | null
          profile_id?: string
          region?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workplaces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplaces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_expert_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workplaces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_expert_list"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_expert_detail: {
        Row: {
          academic_records: Json | null
          blog_url: string | null
          cover_image_path: string | null
          display_name: string | null
          educations: Json | null
          experiences: Json | null
          headline: string | null
          id: string | null
          instagram_url: string | null
          introduction: string | null
          kakao_url: string | null
          licenses: Json | null
          professions: Json | null
          profile_image_path: string | null
          specialties: Json | null
          threads_url: string | null
          total_experience_years: number | null
          workplace_address: string | null
          workplace_address_detail: string | null
          workplace_center_name: string | null
          workplace_external_contact_url: string | null
          workplace_latitude: number | null
          workplace_longitude: number | null
          workplace_phone: string | null
          workplace_region: string | null
          workplace_website_url: string | null
          youtube_url: string | null
        }
        Relationships: []
      }
      public_expert_list: {
        Row: {
          display_name: string | null
          headline: string | null
          id: string | null
          professions: Json | null
          profile_image_path: string | null
          specialties: Json | null
          total_experience_years: number | null
          workplace_center_name: string | null
          workplace_region: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_account_deletion: {
        Args: never
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      get_admin_audit_log: {
        Args: {
          p_action_type?: string
          p_admin_user_id?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
        }
        Returns: {
          action_type: string
          admin_email: string
          admin_user_id: string
          created_at: string
          id: string
          memo: string
          target_display_name: string
          target_license_name: string
          target_profile_id: string
        }[]
      }
      get_admin_dashboard_stats: {
        Args: never
        Returns: {
          approved_count: number
          draft_count: number
          pending_count: number
          public_count: number
          rejected_count: number
          total_signups: number
        }[]
      }
      get_admin_review_kpis: {
        Args: never
        Returns: {
          approved_count: number
          avg_processing_hours: number
          pending_count: number
          rejected_count: number
        }[]
      }
      get_admin_users_list: {
        Args: never
        Returns: {
          email: string
          role: string
          user_id: string
        }[]
      }
      get_own_rejection_reason: { Args: never; Returns: string }
      get_public_licenses: {
        Args: { p_profile_id: string }
        Returns: {
          acquired_date: string
          category: string
          issuing_organization: string
          license_name: string
        }[]
      }
      is_admin: { Args: { user_id?: string }; Returns: boolean }
      is_profile_public_approved: {
        Args: { profile_id: string }
        Returns: boolean
      }
      is_user_profile_public_approved: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      replace_profile_professions: {
        Args: { p_professions: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      replace_profile_specialties: {
        Args: { p_specialties: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      request_account_deletion: {
        Args: never
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      review_expert_profile: {
        Args: {
          p_decision: string
          p_rejection_reason?: string
          p_target_user_id: string
        }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      review_license: {
        Args: { p_decision: string; p_license_id: string; p_memo?: string }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_academic_records: {
        Args: { p_records: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_educations: {
        Args: { p_educations: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_experiences: {
        Args: { p_experiences: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_gallery_images: {
        Args: { p_images: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_licenses: {
        Args: { p_licenses: Json }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      save_own_profile: {
        Args: {
          p_blog_url?: string
          p_cover_image_path?: string
          p_display_name: string
          p_headline: string
          p_instagram_url?: string
          p_introduction: string
          p_kakao_url?: string
          p_profile_image_path: string
          p_threads_url?: string
          p_youtube_url?: string
        }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      search_public_experts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_professions?: string[]
          p_query?: string
          p_regions?: string[]
          p_specialty_slugs?: string[]
        }
        Returns: {
          display_name: string | null
          headline: string | null
          id: string | null
          professions: Json | null
          profile_image_path: string | null
          specialties: Json | null
          total_experience_years: number | null
          workplace_center_name: string | null
          workplace_region: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "public_expert_list"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_own_academic_record_visibility: {
        Args: { p_record_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_education_visibility: {
        Args: { p_education_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_experience_period_visibility: {
        Args: { p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_experience_visibility: {
        Args: { p_experience_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_gallery_image_visibility: {
        Args: { p_image_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_license_visibility: {
        Args: { p_license_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_profile_visibility: {
        Args: { p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_specialty_visibility: {
        Args: { p_specialty_id: string; p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      set_own_workplace_visibility: {
        Args: { p_visible: boolean }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      submit_profile: {
        Args: never
        Returns: {
          error: string
          ok: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

