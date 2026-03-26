import { supabase } from '../../lib/supabase';
import { UserSettings } from '../../types';

export async function getUserSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching user settings:', error);
    return null;
  }

  return data;
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      ...patch,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
}
