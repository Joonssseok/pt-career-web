"use client";
import { createContext } from "react";
import type { ExpertProfileViewProps } from "@/components/experts/ExpertProfileView";
export type CommonProfilePreview = Partial<
  Pick<
    ExpertProfileViewProps["expert"],
    | "display_name"
    | "profile_image_path"
    | "cover_image_path"
    | "professions"
    | "specialties"
    | "youtube_url"
    | "instagram_url"
    | "blog_url"
    | "threads_url"
    | "kakao_url"
  >
>;
export type CommonProfileSave = () => Promise<boolean>;
export const CommonProfileSaveContext = createContext<{
  register: (save: CommonProfileSave | null) => void;
  preview?: (value: CommonProfilePreview) => void;
  busy?: (value: boolean) => void;
}>({ register: () => {} });
