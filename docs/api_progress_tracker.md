## API 接口进度追踪

追踪所有 API 接口的前后端实现和测试状态。

**状态说明：** ✅ 完成 | 🔧 进行中 | ❌ 未开始

---

### 身份验证（公开）

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /auth/register` | 注册用户 | ✅ | ✅ |
| `POST /auth/login` | 用户登录 | ✅ | ✅ |
| `POST /auth/logout` | 用户登出 | ✅ | ✅ |
| `POST /auth/forgot-password` | 请求密码重置令牌 | ❌ | ✅ |
| `POST /auth/reset-password` | 使用令牌重置密码 | ❌ | ✅ |

### 用户

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `GET /api/profile` | 获取当前用户信息 | ✅ | ✅ |
| `PATCH /api/profile` | 更新用户信息（用户名、邮箱、密码等） | ❌ | ❌ |

### 卡组

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /api/decks` | 创建卡组（创建后自动预排24小时） | ✅ | ✅ |
| `GET /api/decks` | 获取所有卡组 | ✅ | ✅ |
| `GET /api/decks/{id}` | 获取卡组详情 | ✅ | ✅ |
| `PATCH /api/decks/{id}` | 更新卡组 | ✅ | ✅ |
| `DELETE /api/decks/{id}` | 删除卡组 | ✅ | ✅ |
| `GET /api/decks/{id}/card` (meta) | 假期检测：通过 card 元数据返回 | ❌ | ✅ |
| `POST /api/decks/{id}/split` | 拆分卡组为子卡组（按章节） | ❌ | ❌ |
| `GET /api/decks/public/{id}` | 下载公开卡组 | ❌ | ❌ |

### 词条

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /api/decks/{id}/facts/{operation}` | 添加词条 (append/prepend/shuffle/spread)，body 为 facts + 可选 template | ✅ | ✅ |
| `GET /api/decks/{id}/facts` | 获取所有词条 | ✅ | ✅ |
| `GET /api/decks/{id}/facts/{factId}` | 获取单个词条 | ✅ | ✅ |
| `PATCH /api/decks/{id}/facts/{factId}` | 更新词条 | ✅ | ✅ |
| `DELETE /api/decks/{id}/facts/{factId}` | 删除词条 | ✅ | ✅ |
| `GET /api/decks/{id}/facts/search` | 模糊搜索词条（提前复习特定单词） | ❌ | ❌ |

### 卡片

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `GET /api/decks/{id}/card` | 获取最紧急卡片 | ✅ | ✅ |
| `POST /api/decks/{id}/card` | 为已有词条添加一张卡片（body: fact_id, template [[正面],[背面]]，可选 operation: append/prepend/shuffle/spread） | ✅ | ✅ |
| `PATCH /api/decks/{id}/card` | 更新卡片间隔或可见性（按 card_id 查找，支持 last_review 离线同步） | ✅ | ✅ |
| `GET /api/decks/{id}/cards` | 获取卡片统计（总数、隐藏数量、隐藏事实） | ✅ | ✅ |
| `DELETE /api/decks/{id}/cards/{cardId}` | 删除单张卡片（词条与其他卡片不变） | ✅ | ✅ |
| `POST /api/decks/{id}/reschedule` | 假期模式：按天数平移卡片复习计划 | ✅ | ✅ |

### 排行榜 / 游戏化

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /api/ranking/calculate` | 计算/更新排行榜排名 | ❌ | ❌ |
| `GET /api/ranking` | 获取用户排行榜（按已学单词数） | ❌ | ❌ |
| `GET /api/ranking/me` | 获取当前用户排名 | ❌ | ❌ |

### 媒体

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /api/media` | 上传媒体文件 | ✅ | ✅ |
| `GET /api/media` | 列出用户媒体（支持 since/limit/offset） | ✅ | ✅ |
| `GET /api/media/{id}` | 下载媒体文件 | ✅ | ✅ |
| `GET /api/media/{id}/meta` | 获取媒体元数据 | ✅ | ✅ |
| `DELETE /api/media/{id}` | 删除媒体 | ✅ | ✅ |

### 共享媒体

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `GET /api/media/shared/{id}` | 下载共享媒体 | ❌ | ❌ |
| `GET /api/media/shared?word=...&lang=...` | 按单词查询共享媒体 | ❌ | ❌ |

### 分页支持

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| 所有列表接口 | 支持 `page` / `pageSize` 分页参数 | ❌ | ❌ |

### 标签

| 接口 | 说明 | 前端 | 后端 |
| --- | --- | --- | --- |
| `POST /api/tags` | 创建标签 | ✅ (`src/lib/tags.ts`) | ✅ |
| `GET /api/tags` | 列出用户标签 | ✅ | ✅ |
| `GET /api/tags/{tagId}` | 获取单个标签 | ✅ | ✅ |
| `PATCH /api/tags/{tagId}` | 更新名称/描述 | ✅ | ✅ |
| `DELETE /api/tags/{tagId}` | 删除标签及关联 | ✅ | ✅ |
| `GET /api/tags/{tagId}/facts` | 列出带该标签的词条 | ✅ | ✅ |
| `GET /api/decks/{id}/tags` | 卡组标签列表 | ✅ | ✅ |
| `PUT /api/decks/{id}/tags/{tagId}` | 关联标签到卡组 | ✅ | ✅ |
| `DELETE /api/decks/{id}/tags/{tagId}` | 从卡组移除标签 | ✅ | ✅ |
| `GET /api/decks/{id}/facts/{factId}/tags` | 词条标签列表 | ✅ | ✅ |
| `PUT /api/decks/{id}/facts/{factId}/tags/{tagId}` | 关联标签到词条 | ✅ | ✅ |
| `DELETE /api/decks/{id}/facts/{factId}/tags/{tagId}` | 从词条移除标签 | ✅ | ✅ |
| `GET /api/decks/{id}/card?tag_id=` | 按标签筛选下一张卡 | ✅ (`getNextCard`) | ✅ |
| `GET /api/decks/{id}/cards?tag_id=` | 按标签筛选卡片统计 | ✅ (`getDeckCards`) | ✅ |
| `POST /api/decks` `tags` / `tag_ids` | 创建卡组时打标签 | ✅ (类型) | ✅ |

---

### 其他待办
