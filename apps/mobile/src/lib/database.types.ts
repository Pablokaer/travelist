export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_cache: {
        Row: {
          created_at: string;
          expires_at: string;
          key: string;
          value: NonNullable<Json>;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          key: string;
          value: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          key?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      attraction_reviews: {
        Row: {
          attraction_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attraction_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          attraction_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attraction_reviews_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attraction_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attraction_reviews_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attraction_rating_summary';
            referencedColumns: ['attraction_id'];
          },
          {
            foreignKeyName: 'attraction_reviews_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attractions';
            referencedColumns: ['id'];
          },
        ];
      };
      attractions: {
        Row: {
          avg_visit_minutes: number;
          category: Database['public']['Enums']['attraction_category'];
          city_slug: string;
          description_en: string | null;
          description_pt: string | null;
          fee: string | null;
          id: string;
          image_author: string | null;
          image_license: string | null;
          image_license_url: string | null;
          image_page_url: string | null;
          image_url: string | null;
          is_unesco: boolean;
          location: unknown;
          name_en: string;
          name_pt: string | null;
          opening_hours: string | null;
          osm_id: string | null;
          popularity: number;
          updated_at: string;
          website: string | null;
          wikidata_id: string;
          wikipedia_en: string | null;
          wikipedia_pt: string | null;
        };
        Insert: {
          avg_visit_minutes: number;
          category?: Database['public']['Enums']['attraction_category'];
          city_slug: string;
          description_en?: string | null;
          description_pt?: string | null;
          fee?: string | null;
          id?: string;
          image_author?: string | null;
          image_license?: string | null;
          image_license_url?: string | null;
          image_page_url?: string | null;
          image_url?: string | null;
          is_unesco?: boolean;
          location: unknown;
          name_en: string;
          name_pt?: string | null;
          opening_hours?: string | null;
          osm_id?: string | null;
          popularity?: number;
          updated_at?: string;
          website?: string | null;
          wikidata_id: string;
          wikipedia_en?: string | null;
          wikipedia_pt?: string | null;
        };
        Update: {
          avg_visit_minutes?: number;
          category?: Database['public']['Enums']['attraction_category'];
          city_slug?: string;
          description_en?: string | null;
          description_pt?: string | null;
          fee?: string | null;
          id?: string;
          image_author?: string | null;
          image_license?: string | null;
          image_license_url?: string | null;
          image_page_url?: string | null;
          image_url?: string | null;
          is_unesco?: boolean;
          location?: unknown;
          name_en?: string;
          name_pt?: string | null;
          opening_hours?: string | null;
          osm_id?: string | null;
          popularity?: number;
          updated_at?: string;
          website?: string | null;
          wikidata_id?: string;
          wikipedia_en?: string | null;
          wikipedia_pt?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'city_list';
            referencedColumns: ['slug'];
          },
        ];
      };
      cities: {
        Row: {
          bbox: number[];
          center: unknown;
          country_code: string;
          is_active: boolean;
          name_en: string;
          name_pt: string;
          slug: string;
          timezone: string | null;
          updated_at: string;
          wikidata_id: string;
        };
        Insert: {
          bbox: number[];
          center: unknown;
          country_code: string;
          is_active?: boolean;
          name_en: string;
          name_pt: string;
          slug: string;
          timezone?: string | null;
          updated_at?: string;
          wikidata_id: string;
        };
        Update: {
          bbox?: number[];
          center?: unknown;
          country_code?: string;
          is_active?: boolean;
          name_en?: string;
          name_pt?: string;
          slug?: string;
          timezone?: string | null;
          updated_at?: string;
          wikidata_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cities_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
        ];
      };
      countries: {
        Row: {
          ambulance_number: string | null;
          calling_code: string | null;
          code: string;
          currency_codes: string[];
          driving_side: string | null;
          emergency_number: string | null;
          fire_number: string | null;
          frequency_hz: number | null;
          is_eu: boolean;
          is_schengen: boolean;
          languages: string[];
          name_en: string;
          name_pt: string;
          plug_types: string[];
          police_number: string | null;
          timezones: string[];
          updated_at: string;
          voltage: number | null;
        };
        Insert: {
          ambulance_number?: string | null;
          calling_code?: string | null;
          code: string;
          currency_codes?: string[];
          driving_side?: string | null;
          emergency_number?: string | null;
          fire_number?: string | null;
          frequency_hz?: number | null;
          is_eu?: boolean;
          is_schengen?: boolean;
          languages?: string[];
          name_en: string;
          name_pt: string;
          plug_types?: string[];
          police_number?: string | null;
          timezones?: string[];
          updated_at?: string;
          voltage?: number | null;
        };
        Update: {
          ambulance_number?: string | null;
          calling_code?: string | null;
          code?: string;
          currency_codes?: string[];
          driving_side?: string | null;
          emergency_number?: string | null;
          fire_number?: string | null;
          frequency_hz?: number | null;
          is_eu?: boolean;
          is_schengen?: boolean;
          languages?: string[];
          name_en?: string;
          name_pt?: string;
          plug_types?: string[];
          police_number?: string | null;
          timezones?: string[];
          updated_at?: string;
          voltage?: number | null;
        };
        Relationships: [];
      };
      profile_nationalities: {
        Row: {
          country_code: string;
          created_at: string;
          profile_id: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          profile_id: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_nationalities_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'profile_nationalities_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          home_country: string | null;
          id: string;
          language: string;
          onboarded_at: string | null;
          passport_expiry: string | null;
          theme: string;
          units: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          home_country?: string | null;
          id: string;
          language?: string;
          onboarded_at?: string | null;
          passport_expiry?: string | null;
          theme?: string;
          units?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          home_country?: string | null;
          id?: string;
          language?: string;
          onboarded_at?: string | null;
          passport_expiry?: string | null;
          theme?: string;
          units?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_home_country_fkey';
            columns: ['home_country'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
        ];
      };
      trip_stops: {
        Row: {
          attraction_id: string;
          position: number;
          trip_id: string;
        };
        Insert: {
          attraction_id: string;
          position: number;
          trip_id: string;
        };
        Update: {
          attraction_id?: string;
          position?: number;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_stops_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attraction_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stops_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attraction_rating_summary';
            referencedColumns: ['attraction_id'];
          },
          {
            foreignKeyName: 'trip_stops_attraction_id_fkey';
            columns: ['attraction_id'];
            isOneToOne: false;
            referencedRelation: 'attractions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stops_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          city_slug: string;
          created_at: string;
          distance_m: number | null;
          id: string;
          is_fallback: boolean;
          name: string;
          provider: string | null;
          route_geometry: Json | null;
          trip_date: string | null;
          updated_at: string;
          user_id: string;
          visit_minutes: number | null;
          walking_seconds: number | null;
        };
        Insert: {
          city_slug: string;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          is_fallback?: boolean;
          name: string;
          provider?: string | null;
          route_geometry?: Json | null;
          trip_date?: string | null;
          updated_at?: string;
          user_id?: string;
          visit_minutes?: number | null;
          walking_seconds?: number | null;
        };
        Update: {
          city_slug?: string;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          is_fallback?: boolean;
          name?: string;
          provider?: string | null;
          route_geometry?: Json | null;
          trip_date?: string | null;
          updated_at?: string;
          user_id?: string;
          visit_minutes?: number | null;
          walking_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'trips_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'city_list';
            referencedColumns: ['slug'];
          },
        ];
      };
      visa_requirements: {
        Row: {
          destination: string;
          max_stay_days: number | null;
          passport: string;
          requirement: Database['public']['Enums']['visa_requirement'];
          source: string;
          updated_at: string;
        };
        Insert: {
          destination: string;
          max_stay_days?: number | null;
          passport: string;
          requirement: Database['public']['Enums']['visa_requirement'];
          source?: string;
          updated_at?: string;
        };
        Update: {
          destination?: string;
          max_stay_days?: number | null;
          passport?: string;
          requirement?: Database['public']['Enums']['visa_requirement'];
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      attraction_details: {
        Row: {
          avg_visit_minutes: number | null;
          category: Database['public']['Enums']['attraction_category'] | null;
          city_slug: string | null;
          description_en: string | null;
          description_pt: string | null;
          fee: string | null;
          id: string | null;
          image_author: string | null;
          image_license: string | null;
          image_license_url: string | null;
          image_page_url: string | null;
          image_url: string | null;
          is_unesco: boolean | null;
          lat: number | null;
          lng: number | null;
          name_en: string | null;
          name_pt: string | null;
          opening_hours: string | null;
          osm_id: string | null;
          popularity: number | null;
          website: string | null;
          wikidata_id: string | null;
          wikipedia_en: string | null;
          wikipedia_pt: string | null;
        };
        Insert: {
          avg_visit_minutes?: number | null;
          category?: Database['public']['Enums']['attraction_category'] | null;
          city_slug?: string | null;
          description_en?: string | null;
          description_pt?: string | null;
          fee?: string | null;
          id?: string | null;
          image_author?: string | null;
          image_license?: string | null;
          image_license_url?: string | null;
          image_page_url?: string | null;
          image_url?: string | null;
          is_unesco?: boolean | null;
          lat?: never;
          lng?: never;
          name_en?: string | null;
          name_pt?: string | null;
          opening_hours?: string | null;
          osm_id?: string | null;
          popularity?: number | null;
          website?: string | null;
          wikidata_id?: string | null;
          wikipedia_en?: string | null;
          wikipedia_pt?: string | null;
        };
        Update: {
          avg_visit_minutes?: number | null;
          category?: Database['public']['Enums']['attraction_category'] | null;
          city_slug?: string | null;
          description_en?: string | null;
          description_pt?: string | null;
          fee?: string | null;
          id?: string | null;
          image_author?: string | null;
          image_license?: string | null;
          image_license_url?: string | null;
          image_page_url?: string | null;
          image_url?: string | null;
          is_unesco?: boolean | null;
          lat?: never;
          lng?: never;
          name_en?: string | null;
          name_pt?: string | null;
          opening_hours?: string | null;
          osm_id?: string | null;
          popularity?: number | null;
          website?: string | null;
          wikidata_id?: string | null;
          wikipedia_en?: string | null;
          wikipedia_pt?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'city_list';
            referencedColumns: ['slug'];
          },
        ];
      };
      attraction_rating_summary: {
        Row: {
          attraction_id: string | null;
          city_slug: string | null;
          rating_avg: number | null;
          review_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'attractions_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'city_list';
            referencedColumns: ['slug'];
          },
        ];
      };
      city_list: {
        Row: {
          attraction_count: number | null;
          bbox: number[] | null;
          country_code: string | null;
          country_name_en: string | null;
          country_name_pt: string | null;
          cover_image_author: string | null;
          cover_image_license: string | null;
          cover_image_url: string | null;
          lat: number | null;
          lng: number | null;
          name_en: string | null;
          name_pt: string | null;
          slug: string | null;
          timezone: string | null;
          wikidata_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cities_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
        ];
      };
    };
    Functions: {
      attractions_in_view: {
        Args: {
          categories?: Database['public']['Enums']['attraction_category'][];
          max_lat: number;
          max_lng: number;
          max_results?: number;
          min_lat: number;
          min_lng: number;
        };
        Returns: {
          avg_visit_minutes: number;
          category: Database['public']['Enums']['attraction_category'];
          city_slug: string;
          id: string;
          image_url: string;
          is_unesco: boolean;
          lat: number;
          lng: number;
          name_en: string;
          name_pt: string;
          popularity: number;
        }[];
      };
      delete_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      list_attraction_reviews: {
        Args: { p_attraction_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          author_name: string;
          comment: string;
          created_at: string;
          id: string;
          is_own: boolean;
          rating: number;
          updated_at: string;
        }[];
      };
      save_review: {
        Args: { p_attraction_id: string; p_comment?: string; p_rating: number };
        Returns: string;
      };
      save_trip: {
        Args: {
          p_attraction_ids: string[];
          p_city_slug: string;
          p_distance_m?: number;
          p_is_fallback?: boolean;
          p_name: string;
          p_provider?: string;
          p_route_geometry?: Json;
          p_trip_date?: string;
          p_visit_minutes?: number;
          p_walking_seconds?: number;
        };
        Returns: string;
      };
      set_nationalities: { Args: { codes: string[] }; Returns: undefined };
    };
    Enums: {
      attraction_category:
        | 'museum'
        | 'monument'
        | 'church'
        | 'castle'
        | 'viewpoint'
        | 'landmark'
        | 'park'
        | 'palace'
        | 'other';
      visa_requirement:
        | 'freedom_of_movement'
        | 'visa_free'
        | 'visa_on_arrival'
        | 'eta'
        | 'e_visa'
        | 'visa_required'
        | 'no_admission';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      attraction_category: [
        'museum',
        'monument',
        'church',
        'castle',
        'viewpoint',
        'landmark',
        'park',
        'palace',
        'other',
      ],
      visa_requirement: [
        'freedom_of_movement',
        'visa_free',
        'visa_on_arrival',
        'eta',
        'e_visa',
        'visa_required',
        'no_admission',
      ],
    },
  },
} as const;
