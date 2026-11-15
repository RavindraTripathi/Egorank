import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AuditLogRecord,
  ChallengeRecord,
  ChampionHistoryRecord,
  FeaturedTier,
  LeaderboardState,
  NotificationRecord,
  PaymentRecord,
  Profile,
  ReportRecord,
  TIER_PRIORITY,
} from '../types/egorank';
import {
  DEMO_CHAMPION_HISTORY,
  DEMO_LEADERBOARD_STATE,
  DEMO_PROFILES,
} from './demoData';

export function sortProfilesForLeaderboard(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) => {
    const tierDiff = TIER_PRIORITY[b.featuredTier] - TIER_PRIORITY[a.featuredTier];
    if (tierDiff !== 0) return tierDiff;
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function fetchPublicProfiles(): Promise<{
  profiles: Profile[];
  hasDemoFallback: boolean;
}> {
  const path = 'profiles';
  try {
    const q = query(collection(db, path), where('isSuspended', '==', false));
    const snap = await getDocs(q);
    const liveProfiles = snap.docs.map((d) => d.data() as Profile);
    if (liveProfiles.length === 0) {
      return { profiles: sortProfilesForLeaderboard(DEMO_PROFILES), hasDemoFallback: true };
    }
    return { profiles: sortProfilesForLeaderboard(liveProfiles), hasDemoFallback: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchProfileByUid(uid: string): Promise<Profile | null> {
  const path = `profiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    return snap.exists() ? (snap.data() as Profile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const lower = username.toLowerCase().trim();
  const demoMatch = DEMO_PROFILES.find((p) => p.usernameLower === lower);

  const path = 'profiles';
  try {
    const q = query(
      collection(db, path),
      where('isSuspended', '==', false),
      where('usernameLower', '==', lower),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Profile;
    }
    return demoMatch || null;
  } catch (error) {
    if (demoMatch) return demoMatch;
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchLeaderboardState(): Promise<LeaderboardState> {
  const path = 'leaderboard_state/global';
  try {
    const snap = await getDoc(doc(db, 'leaderboard_state', 'global'));
    if (snap.exists()) {
      return snap.data() as LeaderboardState;
    }
    return DEMO_LEADERBOARD_STATE;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchChampionHistory(): Promise<ChampionHistoryRecord[]> {
  const path = 'champion_history';
  try {
    const q = query(collection(db, path), orderBy('startedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    if (snap.empty) {
      return DEMO_CHAMPION_HISTORY;
    }
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChampionHistoryRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchSandboxChallenges(): Promise<ChallengeRecord[]> {
  const path = 'challenges';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(25));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChallengeRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function checkUsernameAvailability(
  username: string,
  currentUid?: string
): Promise<boolean> {
  const lower = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,32}$/.test(lower)) return false;
  if (DEMO_PROFILES.some((p) => p.usernameLower === lower)) return false;

  const path = `usernames/${lower}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', lower));
    if (!snap.exists()) return true;
    const data = snap.data() as { uid: string };
    return Boolean(currentUid && data.uid === currentUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(params: {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  websiteUrl: string;
  achievement: string;
  socialLinks: { x?: string; instagram?: string; linkedin?: string };
  referredByCode?: string;
}): Promise<Profile> {
  const usernameClean = params.username.trim();
  const usernameLower = usernameClean.toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(usernameLower)) {
    throw new Error('Username must be 3–32 characters using only letters, numbers, and underscores.');
  }
  if (DEMO_PROFILES.some((p) => p.usernameLower === usernameLower)) {
    throw new Error('That handle is reserved. Please choose another username.');
  }

  const now = new Date().toISOString();
  const profileRef = doc(db, 'profiles', params.uid);
  const newUsernameRef = doc(db, 'usernames', usernameLower);

  try {
    const saved = await runTransaction(db, async (tx) => {
      const existingProfileSnap = await tx.get(profileRef);
      const usernameSnap = await tx.get(newUsernameRef);

      if (usernameSnap.exists() && usernameSnap.data().uid !== params.uid) {
        throw new Error('Username is already claimed by another competitor.');
      }

      if (existingProfileSnap.exists()) {
        const current = existingProfileSnap.data() as Profile;
        if (current.usernameLower !== usernameLower) {
          tx.delete(doc(db, 'usernames', current.usernameLower));
          tx.set(newUsernameRef, { uid: params.uid, createdAt: now });
        }

        const updated: Profile = {
          ...current,
          username: usernameClean,
          usernameLower,
          displayName: params.displayName.trim(),
          avatarUrl: params.avatarUrl.trim(),
          bio: params.bio.trim(),
          websiteUrl: params.websiteUrl.trim(),
          achievement: params.achievement.trim(),
          socialLinks: params.socialLinks,
          updatedAt: now,
        };

        tx.update(profileRef, {
          username: updated.username,
          usernameLower: updated.usernameLower,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
          bio: updated.bio,
          websiteUrl: updated.websiteUrl,
          achievement: updated.achievement,
          socialLinks: updated.socialLinks,
          updatedAt: updated.updatedAt,
        });

        return updated;
      } else {
        const referralCode = `${usernameLower.slice(0, 6).toUpperCase()}${params.uid.slice(0, 4).toUpperCase()}`;
        const created: Profile = {
          uid: params.uid,
          username: usernameClean,
          usernameLower,
          displayName: params.displayName.trim(),
          avatarUrl: params.avatarUrl.trim(),
          bio: params.bio.trim(),
          websiteUrl: params.websiteUrl.trim(),
          achievement: params.achievement.trim() || 'Active EgoRank Competitor',
          socialLinks: params.socialLinks,
          badges: ['First Member'],
          featuredTier: 'none',
          referralCode,
          referredBy: params.referredByCode || '',
          isSuspended: false,
          isDemo: false,
          rankScore: 100,
          createdAt: now,
          updatedAt: now,
        };

        tx.set(newUsernameRef, { uid: params.uid, createdAt: now });
        tx.set(profileRef, created);

        const notifRef = doc(collection(db, 'notifications'));
        tx.set(notifRef, {
          uid: params.uid,
          type: 'achievement',
          title: 'Badge Earned: First Member',
          message: `Welcome to EgoRank, @${usernameClean}. Your public profile is now live.`,
          read: false,
          createdAt: now,
        });

        return created;
      }
    });

    if (params.referredByCode && !saved.updatedAt?.includes('updated')) {
      try {
        const refQuery = query(
          collection(db, 'profiles'),
          where('isSuspended', '==', false),
          where('referralCode', '==', params.referredByCode),
          limit(1)
        );
        const refSnap = await getDocs(refQuery);
        if (!refSnap.empty) {
          const referrer = refSnap.docs[0].data() as Profile;
          if (referrer.uid !== params.uid) {
            await setDoc(doc(collection(db, 'referrals')), {
              referrerUid: referrer.uid,
              referredUid: params.uid,
              referralCode: params.referredByCode,
              createdAt: now,
            });
          }
        }
      } catch {
        // Non-blocking referral attribution
      }
    }

    return saved;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already claimed') || error.message.includes('Username must'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `profiles/${params.uid}`);
  }
}

export async function claimSandboxThrone(profile: Profile): Promise<LeaderboardState> {
  const now = new Date().toISOString();
  const stateRef = doc(db, 'leaderboard_state', 'global');

  try {
    const activeHistoryQuery = query(
      collection(db, 'champion_history'),
      where('endedAt', '==', null),
      limit(1)
    );
    const activeHistorySnap = await getDocs(activeHistoryQuery);
    const activeHistoryDoc = activeHistorySnap.empty ? null : activeHistorySnap.docs[0];

    const nextState = await runTransaction(db, async (tx) => {
      const stateSnap = await tx.get(stateRef);
      if (!stateSnap.exists()) {
        throw new Error(
          'The live Sandbox Throne state has not been initialized by an administrator yet.'
        );
      }

      const current = stateSnap.data() as LeaderboardState;
      const newPriceCents = current.nextPriceCents;
      const updatedState: LeaderboardState = {
        currentChampionUid: profile.uid,
        currentChampionUsername: profile.username,
        currentChampionDisplayName: profile.displayName,
        currentChampionAvatar: profile.avatarUrl,
        currentChampionAchievement: profile.achievement || 'Sandbox Throne Conqueror',
        currentPriceCents: newPriceCents,
        nextPriceCents: newPriceCents + 100,
        version: current.version + 1,
        updatedAt: now,
      };

      tx.update(stateRef, updatedState as unknown as Record<string, unknown>);

      if (activeHistoryDoc) {
        const prevData = activeHistoryDoc.data() as ChampionHistoryRecord;
        const ms = Math.max(60_000, Date.now() - new Date(prevData.startedAt).getTime());
        const mins = Math.floor(ms / 60_000);
        const hrs = Math.floor(mins / 60);
        const durationLabel = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
        tx.update(activeHistoryDoc.ref, {
          endedAt: now,
          durationLabel,
        });
      }

      const newHistoryRef = doc(collection(db, 'champion_history'));
      tx.set(newHistoryRef, {
        uid: profile.uid,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        achievement: profile.achievement || 'Sandbox Throne Conqueror',
        winningPriceCents: newPriceCents,
        startedAt: now,
        endedAt: null,
        durationLabel: 'Active Sandbox Reign',
        isDemo: false,
      });

      const challengeRef = doc(collection(db, 'challenges'));
      tx.set(challengeRef, {
        challengerUid: profile.uid,
        challengerUsername: profile.username,
        previousChampionUid: current.currentChampionUid,
        offeredPriceCents: newPriceCents,
        status: 'sandbox_completed',
        createdAt: now,
      });

      return updatedState;
    });

    return nextState;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Sandbox Throne state')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, 'leaderboard_state/global');
  }
}

export async function fetchUserNotifications(uid: string): Promise<NotificationRecord[]> {
  const path = 'notifications';
  try {
    const q = query(
      collection(db, path),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserPayments(uid: string): Promise<PaymentRecord[]> {
  const path = 'payments';
  try {
    const q = query(
      collection(db, path),
      where('user_id', '==', uid),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchUserReferralCount(uid: string): Promise<number> {
  const path = 'referrals';
  try {
    const q = query(collection(db, path), where('referrerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function submitProfileReport(params: {
  reporterUid: string;
  targetUid: string;
  targetUsername: string;
  reason: string;
}): Promise<void> {
  const path = 'reports';
  try {
    await setDoc(doc(collection(db, path)), {
      reporterUid: params.reporterUid,
      targetUid: params.targetUid,
      targetUsername: params.targetUsername,
      reason: params.reason.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- ADMIN OPERATIONS ---

export async function adminSeedDemoArena(actorUid: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    for (const p of DEMO_PROFILES) {
      await setDoc(doc(db, 'profiles', p.uid), p, { merge: true });
    }
    await setDoc(doc(db, 'leaderboard_state', 'global'), {
      ...DEMO_LEADERBOARD_STATE,
      isDemo: false,
      updatedAt: now,
    });
    for (const h of DEMO_CHAMPION_HISTORY) {
      await setDoc(doc(db, 'champion_history', h.id), h, { merge: true });
    }
    await setDoc(doc(collection(db, 'audit_logs')), {
      actorUid,
      action: 'seed_arena',
      target: 'global',
      details: 'Initialized Firestore leaderboard_state, profiles, and champion_history records.',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'admin_seed');
  }
}

export async function adminFetchAllProfiles(): Promise<Profile[]> {
  try {
    const snap = await getDocs(collection(db, 'profiles'));
    return sortProfilesForLeaderboard(snap.docs.map((d) => d.data() as Profile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'profiles');
  }
}

export async function adminFetchAllPayments(): Promise<PaymentRecord[]> {
  try {
    const q = query(collection(db, 'payments'), orderBy('created_at', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payments');
  }
}

export async function adminFetchReports(): Promise<ReportRecord[]> {
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reports');
  }
}

export async function adminFetchAuditLogs(): Promise<AuditLogRecord[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }
}

export async function adminToggleSuspendProfile(
  actorUid: string,
  targetUid: string,
  suspend: boolean
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'profiles', targetUid), {
      isSuspended: suspend,
      updatedAt: now,
    });
    await setDoc(doc(collection(db, 'audit_logs')), {
      actorUid,
      action: suspend ? 'suspend_user' : 'unsuspend_user',
      target: targetUid,
      details: `Account ${suspend ? 'suspended' : 'restored'} by admin`,
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${targetUid}`);
  }
}

export async function adminUpdateFeaturedTier(
  actorUid: string,
  targetUid: string,
  tier: FeaturedTier
): Promise<void> {
  const now = new Date();
  const expiresAt =
    tier === 'none'
      ? null
      : new Date(now.getTime() + (tier === 'featured_7d' ? 7 : 30) * 86400 * 1000).toISOString();
  try {
    await updateDoc(doc(db, 'profiles', targetUid), {
      featuredTier: tier,
      featuredExpiresAt: expiresAt,
      updatedAt: now.toISOString(),
    });
    await setDoc(doc(collection(db, 'audit_logs')), {
      actorUid,
      action: 'admin_set_featured_tier',
      target: targetUid,
      details: `Featured tier changed to ${tier}`,
      createdAt: now.toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${targetUid}`);
  }
}

export async function adminResolveReport(
  actorUid: string,
  reportId: string,
  status: 'reviewed' | 'dismissed'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), { status });
    await setDoc(doc(collection(db, 'audit_logs')), {
      actorUid,
      action: `report_${status}`,
      target: reportId,
      details: `Report marked ${status}`,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
}
