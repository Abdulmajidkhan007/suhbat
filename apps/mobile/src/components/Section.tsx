import type { ReactNode } from 'react';
import { Children, Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

interface Props {
  title?:    string;
  footer?:   string;
  children:  ReactNode;
  /** Qatorlar orasidagi chiziq chapdan shuncha suriladi (ikonka/avatar kengligi). */
  inset?:    number;
}

/** Sarlavhali yumaloq karta: ichidagi qatorlar ajratgich bilan. */
export const Section = ({ title, footer, children, inset = space.lg }: Props) => {
  const styles = useStyles(createStyles);
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.root}>
      {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
      <View style={styles.card}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.separator, { marginLeft: inset }]} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { marginTop: space.lg, marginHorizontal: space.md },
  title:     { ...textStyles.section, color: p.primary, marginLeft: space.lg, marginBottom: space.sm },
  card:      { borderRadius: radii.md, overflow: 'hidden', backgroundColor: p.surface },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: p.divider },
  footer:    { ...textStyles.caption, fontSize: 13, color: p.textSecondary, marginHorizontal: space.lg, marginTop: space.sm },
});
