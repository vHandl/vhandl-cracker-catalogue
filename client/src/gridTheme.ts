import { themeQuartz } from 'ag-grid-community';

/** AG Grid look shared by the customer catalogue and the admin product grid. */
export const gridTheme = themeQuartz.withParams({
  accentColor: '#e11d48',
  fontFamily: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
  headerFontFamily: ['Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
  fontSize: 15,
  headerFontSize: 12,
  headerFontWeight: 700,
  headerBackgroundColor: '#fbf9ff',
  headerTextColor: '#756f92',
  foregroundColor: '#17132f',
  borderColor: '#ebe6f3',
  rowHoverColor: '#fbf8ff',
  wrapperBorderRadius: 24,
});
