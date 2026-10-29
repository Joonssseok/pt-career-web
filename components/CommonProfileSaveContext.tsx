"use client";
import { createContext } from "react";
export type CommonProfileSave = () => Promise<boolean>;
export const CommonProfileSaveContext = createContext<{
  register: (save: CommonProfileSave | null) => void;
}>({ register: () => {} });
