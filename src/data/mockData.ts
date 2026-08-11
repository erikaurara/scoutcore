import { MatchupCardData, Player, ScoutingSignal, TeamPowerIndexItem, HistoricalGameLog, TeamComparisonData } from '../types';

export const LOGO_URL = "/scoutcore-logo.svg";
export const TEAM_A_LOGO = "https://lh3.googleusercontent.com/aida-public/AB6AXuBpIlD_G5Rym12-ubq_juXAVA2lpiLd38VSuW63hHRK1rkASIc5wIbwHuh3P8kCLjhj-BrzKshSBGDyyaFPc1W9jHaKOZFpBKnnuAWRshCcI6U8i43i62ebaR7kxEJ5GDqf2uXJgb3Q8rJnoopRSEUmwMdk1sIUFLnhxCmgWlrv9NE6Y3yG1nrBg1ydC-H8z8txXr4El4stQs5i4XzsVjwqFNFTqc1k1h0tXjEmJImAXRRC7ROmk0WhqhD1DY3_CumacfITiz0K7Mw";
export const TEAM_B_LOGO = "https://lh3.googleusercontent.com/aida-public/AB6AXuDJsjMc58a73Waw2ajujcKeA7cpyisej4hzw3b3fVt7Wxsy0t1jLMQ-7ffm3PTEualljfnUK38sS0ISdUjZdPx1Dqn8ZBtdfYPstwOsDwT5eeEh_Ydgp4yM7jt5JGrtGhgdYeudmRVvWbpaeKbtS4WgJGmNUIi1aDSVtE6USwW-cm881wacwXMEU72kbGJeHxEZegP8LJ0i_wX1KxR-ETRTSu5Q2F28Y5IpjlFmUa_ukHr_gCkxTQs_ANmsfMqSnrrP6kBY3rN1jTE";

export const GERRIT_COLE_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuCYz3NAoMtiNAh6yrzuAGnlZmjwpWEv_xP6fnp0DJYgUoZAzQRlLsai6-5IGQQqPU6x1anJe8AUGY0CoEHB8H9LX84UZihLL0nzVpyeguLuuxMAGHtDtwHinz_radAMblu2f9duEyM8tqrgrSn4ReqEIPq4vhYf6HZqTgFi5mFno-3wDfjXRDy1VEaHO-kaa3aYHJPICXWX2RfAkAMsB3f4BqN9sFzfv72jygtWXnESVUEcFHukquc1r7pP5kh0ZmrBzYGCUYM_44E";
export const PITCHER_DELIVERY_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuCHbcyDSautoOXL7CR8qbiFK0djjeyhAine4inmOQcliDxXhH1S6sFc_3bUqDkQnMnYabpIX4IOYh5_loNzrxTR7dVBglZ7odv8PcJkCXSS-gFekZWCmCRZAYid050R3CdtcOiwxAF-JvPPpDkbfnmlT3Qo3552hwALfORbUuDXY2sVLVUqzrlVHALseQihlXKJWA1dJl4LfzW7J4RV5dx1iqet8cu0PrApbwlvH73JRVgSJRdpr87vluljyolZQyXjy_k-k-iLtSc";
export const RAFAEL_DEVERS_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuAS0KzbJDJI5cyI9RBCRCOfeVFYToHWF_exde452omEIZnZkjpUHGHh9MKxYggz75tDokodOFh6Mth_1_qZ3lkCxqhq2WNwWQq5rXgKeHoF2iYQvSiNBhG92-yOmkfsQHhGwYLsHFSOuziJk-xTwlZXzpa-JNkaNFmGey_Y_iiSkX0cOd8gncyY7BSdhUyk1rKeugQ0UGq-PR-olFRQLRIiGC16JC3uHLtHtXvdPdIZStQe3s6gxghtqbS0TUeio5jMKPa67WoPjdY";
export const ZACK_WHEELER_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuARivlZr1EfZwor5YYdhDFlHxFW4rWw1pfntOH3dUxbQFyQn3dA1R5zB_ysy0oL8FdggDSJcjc7upXm3ZSsQCRE74Gq9mehRvNFjhDLq7FGDabTPCKIeepCudg5afOd9yVOilYygDBBkFWr6B188G1RISWUgmmTcI9oee2pqmlvXZu8Z-svtiD_j1cexZQIvVMGVo-LYSWauWqxincXgpHOS_JPUQVNV3EbCiq5JCwesfjy6RTwpSeVbQ7zmeAmBF1ON1z-YxdKjcY";
export const FRANCISCO_LINDOR_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuD84X5xVcevr8F0SxDEf9GLOoT6xH_hAtnU0apfFwz7h1VoA9HZ8jWjnKUTi_6_Sb2GtjH5Vq8OARQTDnSspfaVo8DWWS0-B-JR8tK72Dtp-oLoSVGyatyF7hO7QFTYEx-nZrAe4JpfMKEKtQfhx3Lt2yvYrarBUMWekzW3PgS24feu8vluLE39vG4lDnTotd7ZI69ovZ2pVU_cq8eTFcTbGozuGa837RP3qW1cWm1Y9WbmD5_4euDtLHp8JXUNV6AHAuqVklR9l_Q";
export const AARON_JUDGE_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuBOlwKwUQYh3AyFikk0MW5aQzTbdsjE_pbyJihWihZZgzPXWgopbW0YiU1dxJq0kqMMF-eDjvdmjZBqkCXCA4kymqyc4ej-GIZI4l3hV1hLksPjtKAmWQyEgR-0XFu97LQMtVV7FEOY-Wsx6kq11sC-w8lRrwUno8AJ15pmWbqMDdWMc4UkazpITAph3s1wJf_gK0EAzU3_VRSLTa-4Y29ddlEaGgUtyuRTTK39PuL1M31qyMKL3x-uZD2zk1yPc-MZlJkVT-0lSHw";

export const samplePlayers: Record<string, Player> = {
  cole: {
    id: 'cole',
    name: 'GERRIT COLE',
    team: 'NYY',
    number: '#45',
    position: 'SP',
    batsHand: 'R',
    throwsHand: 'R',
    avatarUrl: GERRIT_COLE_AVATAR,
    stats: {
      avgVelo: 97.4,
      whiffPct: 34.2,
      kPerNine: 11.8,
      era: 2.85,
      whip: 0.98,
    },
    arsenalOrPitchPerf: [
      { label: 'FB', value: 52, colorClass: 'bg-[#00f0ff] text-[#002022]' },
      { label: 'SL', value: 22, colorClass: 'bg-[#b9c8de] text-[#0d1c2d]' },
      { label: 'KC', value: 16, colorClass: 'bg-[#2d3449] text-[#dae2fd]' },
      { label: 'CH', value: 10, colorClass: 'bg-[#3b494b] text-[#dae2fd]' },
    ],
  },
  judge: {
    id: 'judge',
    name: 'AARON JUDGE',
    team: 'NYY',
    number: '#99',
    position: 'RF',
    batsHand: 'R',
    throwsHand: 'R',
    avatarUrl: AARON_JUDGE_AVATAR,
    stats: {
      avgVelo: 0,
      whiffPct: 0,
      kPerNine: 0,
      era: 0,
      whip: 0,
    },
    arsenalOrPitchPerf: [],
  },
};

export const sampleMatchups: MatchupCardData[] = [];
export const scoutingSignals: ScoutingSignal[] = [];
export const teamPowerIndex: TeamPowerIndexItem[] = [];
export const historicalGameLogs: HistoricalGameLog[] = [];
export const recentGameLogs: HistoricalGameLog[] = [];
export const teamComparison: TeamComparisonData | null = null;
