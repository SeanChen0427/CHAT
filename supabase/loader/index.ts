// Sean 版（Supabase）：實際部署到 Edge Function「api」的進入點（透過 Supabase 連接器部署）。
// 它從 GitHub 載入指定 commit 的打包檔 supabase/functions/api/index.ts；Supabase 部署時會把遠端程式一起打包，
// 執行時不再連 GitHub。更新後端：推送新 commit → 把下方 commit 換成新的 → 重新部署這個檔案（verify_jwt 關閉）。
import "https://raw.githubusercontent.com/SeanChen0427/CHAT/d38fd859214aa907d94353652677908a080713e4/supabase/functions/api/index.ts";
