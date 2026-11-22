# Brand asset sources

Downloaded on 2026-11-22. Files are stored unchanged, served locally, and only scaled with CSS.

- `instagram.webp`: Instagram's own website apple-touch icon. The source URL was read from the `180x180` icon link in `https://www.instagram.com/`.
  - https://static.cdninstagram.com/rsrc.php/yw/r/icwX0xAk0pz.webp
- `kakaotalk.svg`: Kakao Developers' official KakaoTalk sharing resource.
  - Resource page: https://developers.kakao.com/tool/resource/talk
  - Asset: https://developers.kakao.com/tool/images/resource/preview/talk-sharing-medium.svg

- `youtube.png`: YouTube's own website `144x144` favicon link.
  - Source page: https://www.youtube.com/
  - Asset: https://www.youtube.com/s/desktop/95c3254f/img/favicon_144x144.png
- `threads.webp`: Threads' own website `256x256` apple-touch icon link.
  - Source page: https://www.threads.com/
  - Asset: https://static.cdninstagram.com/rsrc.php/yn/r/fFvbm7ecCaM.webp
- `naver-blog.png`: NAVER Blog's own website favicon. The response is PNG despite the source URL's `.ico` extension; bytes are unchanged.
  - Source page: https://section.blog.naver.com/BlogHome.naver
  - Asset: https://ssl.pstatic.net/static/blog/icon/favicon.ico

These assets identify the corresponding external services. They do not indicate endorsement. All five social marks in `SocialIcons.tsx` use these local image files. The generic custom-link chain icon is not a company logo and remains a local SVG.
