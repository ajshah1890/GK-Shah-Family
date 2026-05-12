import { useState, useEffect } from 'react';
import { FamilyMember, SAMPLE_MEMBERS } from '../types/family';

const STORAGE_KEY = 'gkshah_family_members';

function migrateMembers(raw: unknown[]): FamilyMember[] {
  return raw.map((m: any) => {
    const migrated = { ...m };
    // Remove old field
    delete migrated.relationship;
    // Migrate familyBranch -> mainFamilyBranch
    if (m.familyBranch && !m.mainFamilyBranch) {
      migrated.mainFamilyBranch = m.familyBranch;
    }
    delete migrated.familyBranch;
    return migrated as FamilyMember;
  });
}

export function useFamilyStore() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = () => {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          setMembers(migrateMembers(JSON.parse(data)));
        } else {
          // Initialize with sample data if empty
          setMembers(SAMPLE_MEMBERS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_MEMBERS));
        }
      } catch (error) {
        console.error('Failed to load family members from localStorage', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const saveMembers = (newMembers: FamilyMember[]) => {
    setMembers(newMembers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMembers));
  };

  const addMember = (member: Omit<FamilyMember, 'id'>) => {
    const newMember = { 
      ...member, 
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    saveMembers([...members, newMember]);
    return newMember;
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    saveMembers(members.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMember = (id: string) => {
    saveMembers(members.filter(m => m.id !== id));
  };
  
  const importMembers = (importedMembers: FamilyMember[]) => {
    saveMembers(importedMembers);
  };

  return {
    members,
    isLoaded,
    addMember,
    updateMember,
    deleteMember,
    importMembers,
  };
}
