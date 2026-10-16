import { UpdateChatInputSchema, canManage, canRemove } from '@suhbat/core';
import type { ChatMember } from '@suhbat/core';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCall } from '../calls/useCall';
import { ActionSheet } from '../components/ActionSheet';
import type { SheetAction } from '../components/ActionSheet';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { ListRow } from '../components/ListRow';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatLastSeen } from '../utils/format';
import { listedMembers } from '../utils/members';
import { subtitleFor } from './ChatScreen';

const roleLabel = (m: ChatMember): string | undefined =>
  m.role === 'owner' ? t('info.role.owner') : m.role === 'admin' ? t('info.role.admin') : undefined;

export const ChatInfoScreen = ({ chatId }: { chatId: string }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const me = useCurrentUser();
  const { back, push, reset } = useNavigation();
  const { state, updateChat, removeMember, setMemberRole, leaveChat, deleteChat } = useChatStore();
  const { services: { calls } } = useSession();
  const call = useCall();
  const chat = state.chats[chatId];
  const [selected, setSelected] = useState<ChatMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!chat) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('info.title')} onBack={back} />
        <EmptyState error title={t('chat.blockedOrGone')} onRetry={() => reset()} actionLabel={t('common.back')} />
      </View>
    );
  }

  const myRole = chat.members.find((m) => m.user.id === me.id)?.role ?? 'member';
  const manager = canManage(chat.type, myRole);
  const name = chatTitle(chat, me.id);
  const subtitle = subtitleFor(chat, me.id, [], state.online);
  const peerId = directPeerId(chat, me.id);
  const peer = chat.members.find((m) => m.user.id === peerId);
  const members = listedMembers(chat.type, chat.members);
  const isChannel = chat.type === 'channel';
  const inCall = call !== null && call.phase !== 'ended';

  const fail = () => Alert.alert(t('common.error'), t('info.actionError'));

  const startEdit = () => {
    setTitle(chat.title ?? '');
    setDescription(chat.description ?? '');
    setEditing(true);
  };

  const parsed = UpdateChatInputSchema.safeParse({ title, description });
  const save = async () => {
    if (!parsed.success) return;
    setSaving(true);
    try {
      await updateChat(chatId, parsed.data);
      setEditing(false);
    } catch {
      fail();
    } finally {
      setSaving(false);
    }
  };

  const confirm = (titleText: string, body: string, action: string, run: () => Promise<void>) =>
    Alert.alert(titleText, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => void run().catch(fail) },
    ]);

  const leave = () => confirm(
    isChannel ? t('info.leaveChannel') : t('info.leaveGroup'), t('info.leaveConfirm'),
    isChannel ? t('info.leaveChannel') : t('info.leaveGroup'),
    async () => {
      await leaveChat(chatId);
      reset('chats');
    },
  );

  const remove = () => confirm(
    isChannel ? t('info.deleteChannel') : t('info.deleteGroup'), t('info.deleteConfirm'), t('menu.delete'),
    async () => {
      await deleteChat(chatId);
      reset('chats');
    },
  );

  const memberActions = (m: ChatMember): SheetAction[] => {
    const actions: SheetAction[] = [];
    if (m.user.id === me.id) return actions;
    if (myRole === 'owner' && m.role !== 'owner') {
      actions.push(m.role === 'admin'
        ? { key: 'demote', label: t('info.removeAdmin'), icon: 'shield-checkmark-outline', onPress: () => void setMemberRole(chatId, m.user.id, 'member').catch(fail) }
        : { key: 'promote', label: t('info.makeAdmin'), icon: 'shield-checkmark-outline', onPress: () => void setMemberRole(chatId, m.user.id, 'admin').catch(fail) });
    }
    if (chat.type !== 'direct' && canRemove(myRole, m.role)) {
      actions.push({
        key: 'remove', label: t('info.removeMember'), icon: 'remove-circle-outline', destructive: true,
        onPress: () => confirm(t('info.removeMember'), m.user.displayName, t('info.removeMember'), () => removeMember(chatId, m.user.id)),
      });
    }
    return actions;
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('info.title')}
        onBack={back}
        right={manager && !editing ? <IconButton icon="pencil" label={t('info.edit')} onPress={startEdit} /> : undefined}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Avatar
            name={name}
            seed={chat.id}
            size={96}
            online={peerId ? state.online[peerId] === true : false}
            icon={isChannel ? 'megaphone-outline' : undefined}
          />
          <Text style={styles.name} accessibilityRole="header">{name}</Text>
          <Text style={[styles.status, subtitle.accent && styles.statusAccent]}>{subtitle.text}</Text>
        </View>

        {peer ? (
          <View style={styles.actions}>
            <IconButton icon="chatbubbles-outline" label={t('info.message')} onPress={back} />
            <IconButton icon="call-outline" label={t('chat.callAudio')} disabled={inCall}
              onPress={() => void calls.startCall({ chatId, peer: peer.user, media: 'audio' }).catch(fail)} />
            <IconButton icon="videocam-outline" label={t('chat.callVideo')} disabled={inCall}
              onPress={() => void calls.startCall({ chatId, peer: peer.user, media: 'video' }).catch(fail)} />
          </View>
        ) : null}

        {editing ? (
          <Section title={t('info.edit')}>
            <View style={styles.form}>
              <Text style={styles.label}>{t('info.titleLabel')}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                maxLength={128}
                accessibilityLabel={t('info.titleLabel')}
                placeholderTextColor={palette.textDisabled}
              />
              {!title.trim() ? <Text style={styles.error}>{t('info.titleRequired')}</Text> : null}
              <Text style={styles.label}>{t('info.description')}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={512}
                accessibilityLabel={t('info.description')}
                placeholderTextColor={palette.textDisabled}
              />
              <View style={styles.formButtons}>
                <View style={styles.flex}>
                  <PrimaryButton label={t('common.save')} onPress={() => void save()} disabled={!parsed.success || !title.trim()} loading={saving} />
                </View>
                <Text style={styles.cancel} onPress={() => setEditing(false)} accessibilityRole="button">{t('common.cancel')}</Text>
              </View>
            </View>
          </Section>
        ) : null}

        {peer?.user.bio || (!peer && chat.description) ? (
          <Section title={peer ? t('info.bio') : t('info.description')}>
            <Text style={styles.text} selectable>{peer ? peer.user.bio : chat.description}</Text>
          </Section>
        ) : null}

        {peer && !state.online[peer.user.id] && peer.lastSeenAt ? (
          <Text style={styles.footer}>{t('chat.lastSeen', { when: formatLastSeen(peer.lastSeenAt) })}</Text>
        ) : null}

        {isChannel ? (
          <Section>
            <ListRow
              title={chat.isPublic ? t('info.public') : t('info.private')}
              icon={chat.isPublic ? 'globe-outline' : 'lock-closed-outline'}
            />
          </Section>
        ) : null}

        {chat.type !== 'direct' ? (
          <Section title={isChannel ? t('info.adminsTitle') : `${t('info.membersTitle')} · ${chat.memberCount}`} inset={72}>
            {manager ? (
              <ListRow
                title={isChannel ? t('info.addSubscribers') : t('info.addMembers')}
                icon="person-add-outline"
                iconColor={palette.primary}
                onPress={() => push({ name: 'addMembers', chatId })}
              />
            ) : null}
            {members.map((m) => {
              const actions = memberActions(m);
              const online = state.online[m.user.id] === true;
              return (
                <ListRow
                  key={m.user.id}
                  title={m.user.id === me.id ? `${m.user.displayName} (${t('common.you')})` : m.user.displayName}
                  subtitle={online ? t('chat.online') : m.lastSeenAt ? t('chat.lastSeen', { when: formatLastSeen(m.lastSeenAt) }) : undefined}
                  left={<Avatar name={m.user.displayName} seed={m.user.id} size={42} online={online} />}
                  right={roleLabel(m) ? <Text style={styles.role}>{roleLabel(m)}</Text> : undefined}
                  onPress={actions.length > 0 ? () => setSelected(m) : undefined}
                />
              );
            })}
          </Section>
        ) : null}

        {chat.type !== 'direct' ? (
          <Section>
            {myRole === 'owner' ? (
              <ListRow
                title={isChannel ? t('info.deleteChannel') : t('info.deleteGroup')}
                icon="trash-outline"
                destructive
                onPress={remove}
              />
            ) : (
              <ListRow
                title={isChannel ? t('info.leaveChannel') : t('info.leaveGroup')}
                icon="exit-outline"
                destructive
                onPress={leave}
              />
            )}
          </Section>
        ) : null}
      </ScrollView>
      <ActionSheet
        visible={selected !== null}
        title={selected?.user.displayName}
        actions={selected ? memberActions(selected) : []}
        onClose={() => setSelected(null)}
      />
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:         { flex: 1, backgroundColor: p.background },
  body:         { paddingBottom: space.xxxl },
  hero:         { alignItems: 'center', gap: space.xs, paddingVertical: space.xl, backgroundColor: p.surface },
  name:         { ...textStyles.title, color: p.textPrimary, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.lg },
  status:       { ...textStyles.bodySmall, color: p.textSecondary },
  statusAccent: { color: p.primary },
  actions:      { flexDirection: 'row', justifyContent: 'center', gap: space.xl, paddingBottom: space.md, backgroundColor: p.surface },
  text:         { ...textStyles.body, color: p.textPrimary, padding: space.lg },
  footer:       { ...textStyles.caption, color: p.textSecondary, marginHorizontal: space.xxl, marginTop: space.sm },
  role:         { ...textStyles.bodySmall, color: p.primary },
  form:         { padding: space.lg, gap: space.sm },
  label:        { ...textStyles.bodySmall, color: p.textSecondary, fontWeight: '600' },
  input: {
    ...textStyles.body, fontSize: 16, color: p.textPrimary, backgroundColor: p.surfaceHighlight,
    borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2,
  },
  multiline:    { minHeight: 80, textAlignVertical: 'top' },
  error:        { ...textStyles.caption, color: p.danger },
  formButtons:  { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  flex:         { flex: 1 },
  cancel:       { ...textStyles.button, color: p.primary, paddingVertical: space.sm },
});
