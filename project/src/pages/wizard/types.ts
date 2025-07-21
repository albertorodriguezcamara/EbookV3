// Tipos globales para el wizard de creación de libros

export interface WizardState {
  step: number;
  categoryId: string | null;
  subcategoryId: string | null;
  details: Record<string, any>;
  isIllustrated: boolean;
  hasCover: boolean;
  requestId?: string | null;
  agentConfig: {
    editor:  ProviderChoice | null;
    writer:  ProviderChoice | null;
    image:   ProviderChoice | null;
    cover: ProviderChoice | null;   // Standardized to 'cover' for cover generation
  };
}

export interface Category {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  parent_id?: string | null; // Used to identify subcategories
  // Add any other relevant category properties, e.g., icon, color
}

// Subcategory can reuse the Category type if its structure is the same
// or be a distinct type if it has different properties.
// For now, we'll assume subcategories are Categories with a parent_id.

export type AttributeType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date' | 'email' | 'url' | 'array';

export interface SubcategoryAttribute {
  id: string;
  subcategory_id: string;
  name: string; // Internal name, used for keys
  display_name: string; // Label for the form field
  description?: string | null; // Help text or tooltip
  type: AttributeType;
  required?: boolean | null;
  options?: string[] | null; // For 'select' type, array of option values
  default_value?: string | null;
  placeholder?: string | null;
  validation_rule?: string | null; // Could be a regex or a specific validation keyword
  display_order?: number | null;
  // Potentially add min, max, minLength, maxLength, pattern for more granular validation
}

export interface ProviderChoice {
  providerId: string;
  modelId: string;
}

export interface AIProvider {
  id: string;
  name: string;
}

export interface AIModel {
  id: string;
  name: string; // Internal name/slug, e.g., "claude-3-opus"
  display_name: string; // User-facing name, e.g., "Claude 3 Opus"
  type: string; // Role type, e.g., 'writer', 'editor', 'image', 'cover'
  provider_id: string; // Foreign key to ai_providers table
  active: boolean;
  // Consider adding price_per_1k if cost estimation is needed in the future
}
