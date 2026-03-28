import type { Project, ProjectSettings } from "../../types";

export type ProjectForm = { name: string; genre: string; logline: string };

export type SettingsForm = {
  world_setting: string;
  style_guide: string;
  constraints: string;
};

export type SettingsLoaded = { project: Project; settings: ProjectSettings };
export type SaveSnapshot = { projectForm: ProjectForm; settingsForm: SettingsForm };

export type ProjectMembershipItem = {
  project_id: string;
  user: { id: string; display_name: string | null; is_admin: boolean };
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export function createDefaultProjectForm(): ProjectForm {
  return { name: "", genre: "", logline: "" };
}

export function createDefaultSettingsForm(): SettingsForm {
  return {
    world_setting: "",
    style_guide: "",
    constraints: "",
  };
}

type LoadedSettingsFormMapping = {
  projectForm: ProjectForm;
  settingsForm: SettingsForm;
};

export function mapLoadedSettingsToForms(loaded: SettingsLoaded): LoadedSettingsFormMapping {
  const { project, settings } = loaded;
  return {
    projectForm: {
      name: project.name ?? "",
      genre: project.genre ?? "",
      logline: project.logline ?? "",
    },
    settingsForm: {
      world_setting: settings.world_setting ?? "",
      style_guide: settings.style_guide ?? "",
      constraints: settings.constraints ?? "",
    },
  };
}
