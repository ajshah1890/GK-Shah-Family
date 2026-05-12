import { useEffect } from 'react';
import { FamilyMember } from '@/types/family';
import { parseISO, isToday } from 'date-fns';

export function useNotifications(members: FamilyMember[]) {
  useEffect(() => {
    // Request permission once
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (members.length === 0) return;

    const scheduleCheck = () => {
      const now = new Date();
      const next8AM = new Date(now);
      next8AM.setHours(8, 0, 0, 0);
      if (now >= next8AM) {
        next8AM.setDate(next8AM.getDate() + 1);
      }
      const msUntil8AM = next8AM.getTime() - now.getTime();

      return setTimeout(() => {
        sendTodayNotifications(members);
        // Then repeat every 24 hours
        setInterval(() => sendTodayNotifications(members), 24 * 60 * 60 * 1000);
      }, msUntil8AM);
    };

    // Also fire immediately if it is currently 8:00-8:05 AM (in case app was just opened)
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() < 5) {
      sendTodayNotifications(members);
    }

    const timeoutId = scheduleCheck();
    return () => clearTimeout(timeoutId);
  }, [members]);
}

function sendTodayNotifications(members: FamilyMember[]) {
  const today = new Date();
  
  members.forEach(member => {
    if (member.birthday) {
      try {
        const bday = parseISO(member.birthday);
        const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        if (isToday(thisYear)) {
          new Notification(`🎂 Birthday Today!`, {
            body: `Today is ${member.fullName}'s birthday! Wish them well.`,
            icon: member.photo || '/icon-192.svg',
            tag: `birthday-${member.id}`,
          });
        }
      } catch {}
    }
    if (member.anniversary) {
      try {
        const ann = parseISO(member.anniversary);
        const thisYear = new Date(today.getFullYear(), ann.getMonth(), ann.getDate());
        if (isToday(thisYear)) {
          new Notification(`💍 Anniversary Today!`, {
            body: `Today is ${member.fullName}'s wedding anniversary! Celebrate with them.`,
            icon: member.photo || '/icon-192.svg',
            tag: `anniversary-${member.id}`,
          });
        }
      } catch {}
    }
  });
}
