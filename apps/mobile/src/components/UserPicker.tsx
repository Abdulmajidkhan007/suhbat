import type { PublicUser } from '@suhbat/core';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';
import { useUserSearch } from '../hooks/useUserSearch';
import { t } from '../i18n';
import { space } from '../theme/metrics';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { Icon } from './icon/Icon';
import { ListRow } from './ListRow';

interface Props {
  query:     string;
  selected:  ReadonlyMap<string, PublicUser>;
  onToggle:  (user: PublicUser) => void;
  /** Allaqachon a'zo — tanlab bo'lmaydi. */
  excluded?: ReadonlySet<string>;
  header?:   ReactElement;
}

/** Ko'p tanlovli foydalanuvchi ro'yxati (guruh yaratish, a'zo qo'shish). */
export const UserPicker = ({ query, selected, onToggle, excluded, header }: Props) => {
  const { palette } = useTheme();
  const search = useUserSearch(query);
  // Qidiruv bo'sh bo'lsa — tanlanganlar ko'rinib turadi.
  const data = query.trim() ? search.results : [...selected.values()];
  return (
    <FlatList
      data={data}
      keyExtractor={(u) => u.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {header}
          {search.loading ? <ActivityIndicator style={styles.loader} color={palette.primary} accessibilityLabel={t('search.searching')} /> : null}
        </>
      }
      renderItem={({ item }) => {
        const member = excluded?.has(item.id) ?? false;
        const on = selected.has(item.id);
        return (
          <ListRow
            title={item.displayName}
            subtitle={member ? t('add.alreadyMember') : item.bio ?? undefined}
            left={<Avatar name={item.displayName} seed={item.id} size={42} />}
            right={member ? undefined : (
              <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? palette.primary : palette.textDisabled} />
            )}
            role="checkbox"
            selected={on}
            onPress={member ? undefined : () => onToggle(item)}
          />
        );
      }}
      ListEmptyComponent={
        search.error ? (
          <EmptyState error title={t('new.searchError')} onRetry={search.retry} />
        ) : query.trim() && !search.loading ? (
          <EmptyState icon="search" title={t('new.nobody')} />
        ) : !query.trim() ? (
          <EmptyState icon="person-add-outline" title={t('add.hint')} />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({ loader: { marginVertical: space.md } });
