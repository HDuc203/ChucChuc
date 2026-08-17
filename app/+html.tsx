import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                min-height: 100%;
                background-color: #F8F5EE !important;
                margin: 0;
                padding: 0;
                overflow-x: hidden;
                -webkit-overflow-scrolling: touch;
              }
            `,
          }}
        />
      </head>
      <body style={{ backgroundColor: '#F8F5EE', margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
