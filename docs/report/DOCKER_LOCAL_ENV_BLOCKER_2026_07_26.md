# 로컬 Docker 환경 장애 보고

**Status**: 미해결 — 로컬 DB 검증(`supabase db reset`) 차단 중
**Date**: 2026-07-26
**Authority**: Claude Code (진단)
**영향받는 작업**: M3-A 안정화 완료 기준 중 `supabase db reset`, JWT 보안 테스트 실행, 5개 화면 persistence 확인 (PR #6 참고)

---

## 증상 이력

### 1차 증상 (해결됨)

Docker Desktop이 기동 시 반복적으로 크래시:

```
starting services: initializing Inference manager: listening on
unix://C:\Users\User\AppData\Local\Docker\run\dockerInference:
remove C:\Users\User\AppData\Local\Docker\run\dockerInference:
The file cannot be accessed by the system.
(listener: The filename, directory name, or volume label syntax is incorrect.)
```

**원인**: Docker Desktop의 "Docker AI / Inference" 기능이 생성한 Unix 소켓 파일(`dockerInference`)이 손상된 reparse point 상태로 남아, Windows가 삭제/재생성을 거부.

**시도한 조치**:
1. 비관리자 권한으로 파일 삭제 시도 → 실패 (`cannot be accessed by the system`)
2. Docker Desktop 전체 프로세스 종료 후 재시도 → 실패 (동일)
3. `%APPDATA%\Docker\settings-store.json`의 `EnableDockerAI`를 `false`로 직접 수정 → Inference manager 자체를 비활성화 시도했으나 **동일 크래시 재발** (설정이 무시되거나 이미 초기화 큐에 들어간 상태로 추정)
4. Docker Desktop "Reset to factory defaults" → **동일 크래시 재발**, 파일 자체는 factory reset 범위 밖(런타임 소켓 디렉터리)이라 정리되지 않음
5. **PC 재부팅** → 재부팅 후 해당 파일 자체가 사라짐(파일시스템 잠금이 OS 레벨 핸들에 걸려 있었고, 재부팅으로 핸들이 해제되며 정리된 것으로 추정). 이후 동일 크래시는 재발하지 않음.

### 2차 증상 (현재, 미해결)

재부팅 후 Docker Desktop을 다시 실행하면 크래시는 없지만, **WSL2 백엔드(`docker-desktop` distro)가 계속 `Stopped` 상태에서 벗어나지 않음**:

```
wsl -l -v
  docker-desktop   Stopped   2
```

- `com.docker.backend`, `Docker Desktop` 프로세스는 정상적으로 떠 있음 (30분 이상 유지)
- `docker ps` 명령은 매번 타임아웃 (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`)
- `%LOCALAPPDATA%\Docker\backend.error.json`에 새로운 에러 로그 없음 — 크래시가 아니라 **초기화가 끝나지 않고 계속 대기 중인 상태**

---

## 원인 추정

WSL2 기반 Docker Desktop이 `docker-desktop` VM을 부팅하지 못하고 있음. 흔한 원인:
- WSL2 커널이 최신이 아니거나 손상됨
- Windows의 가상화 플랫폼(Virtual Machine Platform / Hyper-V) 컴포넌트가 이번 재부팅/reset 과정에서 재활성화되지 않음
- 이전 크래시로 생긴 VM 디스크 파일 손상

---

## 사용자가 직접 확인/시도할 수 있는 것 (관리자 권한 필요)

관리자 PowerShell에서 순서대로:

```powershell
wsl --update
wsl --shutdown
```
그 후 Docker Desktop 재실행.

그래도 `docker-desktop` distro가 `Stopped`에서 안 바뀌면:
```powershell
wsl --unregister docker-desktop
```
(Docker Desktop이 재실행 시 자동으로 다시 생성함 — 컨테이너/이미지가 없는 상태라 데이터 손실 없음)

위 방법도 실패하면 Docker Desktop 자체를 완전히 제거 후 재설치가 다음 단계입니다.

---

## 현재 영향

PR #6(`feat/m3a-recovery-clean`)의 코드 수정은 전부 완료·커밋·push됨. 아래 3개만 이 환경 문제로 보류 중:
- `supabase db reset` (신규 migration 2개 실제 적용 검증)
- `tests/m3a-p0-security.test.ts` 실행
- 5개 온보딩 화면 수동 persistence 확인

해결되는 대로 이어서 진행하고 `M3A_RECOVERY_COMPLETION_REPORT_2026_07_26.md`의 실행 증거 표를 업데이트합니다.
