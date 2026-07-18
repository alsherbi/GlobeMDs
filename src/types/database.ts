// GlobeMDs — Database types.
//
// ⚠️ PROVISIONAL: hand-written to match supabase/migrations/*.sql. Once the
// live project schema is reconciled, regenerate with:
//   supabase gen types typescript --project-id ophgnlxuusrupquxinpd > src/types/database.ts
// This file is the single mapping point between the mobile app and Postgres —
// if the web app's real table names differ, fix them HERE and in the API
// modules, never by forking the schema.

export type VerificationStatus = 'unverified' | 'pending_review' | 'verified' | 'rejected';
export type OpenToKind = 'consulting' | 'locum' | 'telemedicine' | 'mentorship';
export type VerificationDocKind = 'medical_license' | 'board_certification' | 'ecfmg_certificate' | 'other';
export type VerificationDocStatus = 'submitted' | 'approved' | 'rejected';
export type ConnectionStatus = 'pending' | 'accepted' | 'declined';
export type GroupPrivacy = 'public' | 'private' | 'invite_only';
export type GroupRole = 'member' | 'admin';
export type GroupMemberStatus = 'pending' | 'approved';
export type PostType = 'text' | 'image' | 'article' | 'poll' | 'link' | 'case';
export type PostVisibility = 'public' | 'connections' | 'group';
export type ReactionKind = 'like' | 'insightful' | 'celebrate' | 'support' | 'curious';
export type JobKind = 'locum' | 'telemedicine' | 'full_time' | 'consulting';
export type ApplicationStatus = 'submitted' | 'reviewed' | 'contacted' | 'closed';
export type EntitlementStatus = 'active' | 'expired' | 'cancelled';
export type NotificationKind =
  | 'connection_request' | 'connection_accepted' | 'new_follower'
  | 'post_reaction' | 'post_comment' | 'comment_reply' | 'post_reshare'
  | 'message' | 'group_invite' | 'group_join_approved' | 'job_match' | 'system';

export interface NotificationPrefs {
  push: boolean;
  connections: boolean;
  messages: boolean;
  reactions: boolean;
  comments: boolean;
  jobs: boolean;
  groups: boolean;
  [key: string]: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  headline: string;
  bio: string;
  avatar_url: string | null;
  specialty: string | null;
  subspecialty: string | null;
  npi_number: string | null;
  npi_verified_at: string | null;
  verification_status: VerificationStatus;
  open_to: OpenToKind[];
  open_to_opportunities: boolean;
  languages: string[];
  accepting_referrals: boolean;
  referral_specialty: string | null;
  referral_regions: string[];
  is_admin: boolean;
  is_recruiter: boolean;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  profile_id: string;
  state: string;
  license_number: string;
  expires_on: string | null;
  created_at: string;
}

export interface BoardCertification {
  id: string;
  profile_id: string;
  board_name: string;
  certification: string;
  year_certified: number | null;
  created_at: string;
}

export interface EducationEntry {
  id: string;
  profile_id: string;
  institution: string;
  degree: string | null;
  kind: string | null;
  start_year: number | null;
  end_year: number | null;
  created_at: string;
}

export interface Publication {
  id: string;
  profile_id: string;
  title: string;
  journal: string | null;
  year: number | null;
  pmid: string | null;
  doi: string | null;
  url: string | null;
  created_at: string;
}

export interface CmeEntry {
  id: string;
  profile_id: string;
  title: string;
  provider: string | null;
  hours: number;
  completed_on: string;
  certificate_path: string | null;
  created_at: string;
}

export interface VerificationDocument {
  id: string;
  profile_id: string;
  kind: VerificationDocKind;
  storage_path: string;
  status: VerificationDocStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  specialty: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  profile_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joined_at: string;
}

export interface GroupEvent {
  id: string;
  group_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  created_by: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface LinkMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  // PubMed citation shape
  pmid?: string;
  authors?: string;
  journal?: string;
  year?: string;
}

export interface Post {
  id: string;
  author_id: string;
  group_id: string | null;
  type: PostType;
  visibility: PostVisibility;
  body: string;
  title: string | null;
  images: string[];
  link_url: string | null;
  link_meta: LinkMeta | null;
  poll_options: PollOption[] | null;
  case_consent_at: string | null;
  hashtags: string[];
  reshare_of: string | null;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostWithAuthor extends Post {
  author: Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'specialty' | 'verification_status'>;
  reaction_count: number;
  comment_count: number;
  my_reaction: ReactionKind | null;
  bookmarked: boolean;
}

export interface PollVote {
  post_id: string;
  voter_id: string;
  option_id: string;
  created_at: string;
}

export interface Reaction {
  post_id: string;
  profile_id: string;
  kind: ReactionKind;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'headline'>;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title: string | null;
  created_by: string;
  is_request: boolean;
  created_at: string;
  last_message_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  profile_id: string;
  last_read_at: string;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  attachment_type: 'image' | 'pdf' | null;
  created_at: string;
}

export interface Institution {
  id: string;
  name: string;
  kind: string | null;
  description: string;
  logo_url: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  country: string;
  created_by: string | null;
  created_at: string;
}

export interface ProfileInstitution {
  id: string;
  profile_id: string;
  institution_id: string;
  role_title: string | null;
  is_current: boolean;
  start_year: number | null;
  end_year: number | null;
  created_at: string;
}

export interface Job {
  id: string;
  institution_id: string | null;
  posted_by: string;
  title: string;
  kind: JobKind;
  specialty: string | null;
  description: string;
  city: string | null;
  state: string | null;
  country: string;
  is_remote: boolean;
  compensation: string | null;
  is_active: boolean;
  created_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  cover_note: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface Entitlement {
  id: string;
  profile_id: string;
  product_id: string;
  status: EntitlementStatus;
  source: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  kind: NotificationKind;
  actor_id: string | null;
  entity: {
    post_id?: string;
    comment_id?: string;
    conversation_id?: string;
    message_id?: string;
    connection_id?: string;
    job_id?: string;
    group_id?: string;
    reaction?: ReactionKind;
  };
  read_at: string | null;
  created_at: string;
}

export interface PushToken {
  profile_id: string;
  expo_token: string;
  platform: string;
  updated_at: string;
}

// ---------- RPC result shapes ----------
export interface ConnectionSuggestion {
  profile_id: string;
  full_name: string;
  headline: string | null;
  avatar_url: string | null;
  specialty: string | null;
  mutual_count: number;
}

export interface ProfileViewer {
  viewer_id: string;
  full_name: string;
  headline: string | null;
  avatar_url: string | null;
  viewed_at: string;
}

export interface ReferralEntry {
  profile_id: string;
  full_name: string;
  headline: string | null;
  avatar_url: string | null;
  referral_specialty: string | null;
  referral_regions: string[];
}

export interface GlobalSearchResult {
  people: Array<Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'specialty' | 'verification_status'>>;
  posts: Array<{ id: string; body: string; title: string | null; author_id: string; created_at: string }>;
  groups: Array<Pick<Group, 'id' | 'name' | 'description' | 'privacy' | 'specialty'>>;
  institutions: Array<Pick<Institution, 'id' | 'name' | 'kind' | 'logo_url' | 'city' | 'state'>>;
  jobs: Array<Pick<Job, 'id' | 'title' | 'kind' | 'specialty' | 'city' | 'state' | 'is_remote'>>;
}
