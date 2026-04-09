# 貢獻指南 / Contributing Guidelines

## Git 工作流程

### 分支策略

我們使用功能分支工作流程（Feature Branch Workflow）：

```
main (預設分支)
  ├── feature/xxx (新功能)
  ├── fix/xxx (bug 修復)
  └── hotfix/xxx (緊急修復)
```

### 開發流程

#### 1. 新功能開發
```bash
# 從 main 建立功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 開發並提交
git add .
git commit -m "feat: 描述你的功能"

# 推送到遠端
git push -u origin feature/your-feature-name
```

#### 2. Bug 修復
```bash
# 從 main 建立修復分支
git checkout main
git pull origin main
git checkout -b fix/your-bug-fix

# 修復並提交
git add .
git commit -m "fix: 描述修復的問題"

# 推送到遠端
git push -u origin fix/your-bug-fix
```

#### 3. 合併回 main
```bash
# 切換回 main
git checkout main
git pull origin main

# 合併功能分支（使用 --no-ff 保留分支歷史）
git merge --no-ff feature/your-feature-name

# 推送到遠端
git push origin main

# 刪除本地和遠端的功能分支（可選）
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Commit 訊息規範

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>: <description>

[optional body]

[optional footer]
```

#### Type 類型

- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文件更新
- `style`: 程式碼格式調整（不影響功能）
- `refactor`: 重構（不是新功能也不是修復）
- `perf`: 效能優化
- `test`: 測試相關
- `chore`: 建構過程或輔助工具的變動
- `ci`: CI 配置檔案和腳本的變動

#### 範例

```bash
feat: 加入使用者認證功能

實作 JWT 認證機制，包含登入、登出和 token 刷新功能。

Closes #123
```

```bash
fix: 修復圖片上傳時的記憶體洩漏問題

圖片上傳後沒有正確釋放資源，導致記憶體持續增長。
現在會在處理完成後正確清理緩衝區。

Fixes #456
```

### Pull Request 流程

1. 推送功能分支到遠端
2. 在 GitHub 上建立 Pull Request
3. 填寫 PR 模板
4. 等待 Code Review
5. 通過後使用「Squash and merge」或「Merge commit」合併
6. **不要使用「Rebase merge」**（會丟失分支歷史）

### 分支命名規範

- `feature/xxx`: 新功能開發
  - 例：`feature/user-authentication`
  - 例：`feature/image-upload`

- `fix/xxx`: Bug 修復
  - 例：`fix/login-error`
  - 例：`fix/memory-leak`

- `hotfix/xxx`: 緊急修復（生產環境）
  - 例：`hotfix/security-patch`
  - 例：`hotfix/critical-bug`

- `refactor/xxx`: 重構
  - 例：`refactor/database-layer`
  - 例：`refactor/api-structure`

### 重要原則

1. **不要直接在 main 分支提交**
   - 所有開發都在功能分支進行
   - main 只接受合併來的 commit

2. **使用 --no-ff 合併**
   - `git merge --no-ff feature/xxx`
   - 保留完整的分支歷史
   - 容易追蹤每個功能的開發歷程

3. **保持 main 分支乾染**
   - main 分支應該隨時可部署
   - 不要在 main 上進行實驗性開發

4. **頻繁提交，小步前進**
   - 每完成一個小功能就 commit
   - 不要累積太多變更才提交

5. **寫好 Commit 訊息**
   - 清楚描述做了什麼
   - 為什麼要這樣做

### 範例工作流程

完整的開發循環範例：

```bash
# 1. 開始新功能
git checkout main
git pull origin main
git checkout -b feature/add-search-functionality

# 2. 開發階段（多次提交）
git add src/search.ts
git commit -m "feat: 加入基本搜尋功能"

git add src/search.test.ts
git commit -m "test: 加入搜尋功能測試"

git add README.md
git commit -m "docs: 更新文件說明搜尋用法"

# 3. 推送到遠端
git push -u origin feature/add-search-functionality

# 4. 在 GitHub 建立 Pull Request
# 進行 Code Review...

# 5. 合併回 main
git checkout main
git pull origin main
git merge --no-ff feature/add-search-functionality
git push origin main

# 6. 清理分支
git branch -d feature/add-search-functionality
git push origin --delete feature/add-search-functionality
```

### 常用指令

```bash
# 查看分支
git branch              # 本地分支
git branch -a           # 所有分支（含遠端）
git branch -v           # 顯示最後一次提交

# 建立分支
git branch <branch-name>                    # 建立分支
git checkout -b <branch-name>               # 建立並切換分支

# 切換分支
git checkout <branch-name>                  # 切換分支
git switch <branch-name>                    # 新語法（Git 2.23+）

# 合併分支
git merge <branch-name>                     # 合併分支
git merge --no-ff <branch-name>             # 合併並保留分支歷史
git merge --squash <branch-name>            # 壓縮合併成一個 commit

# 刪除分支
git branch -d <branch-name>                 # 刪除本地分支
git branch -D <branch-name>                 # 強制刪除本地分支
git push origin --delete <branch-name>      # 刪除遠端分支

# 查看歷史
git log --oneline --graph --all             # 圖形化顯示所有分支
git log --graph --decorate --oneline        # 顯示分支和標籤
```

## 問題排查

### 合併衝突
```bash
# 合併時發生衝突
git merge --no-ff feature/xxx

# 手動解決衝突後
git add <resolved-files>
git commit -m "merge: 解決衝突並合併 feature/xxx"
```

### 撤銷合併
```bash
# 如果合併錯誤
git reset --hard HEAD~1        # 撤銷最後一次合併
# 或
git revert -m 1 <merge-commit> # 建立撤銷合併的新 commit
```

## 參考資料

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git 分支最佳實踐](https://www.atlassian.com/git/tutorials/comparing-workflows)
