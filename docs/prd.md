# Archon Brownfield Enhancement PRD

## Intro Project Analysis and Context

### ⚠️ CRITICAL SCOPE ASSESSMENT

**Enhancement Complexity**: Это значительное улучшение, которое требует архитектурных изменений и множественной поддержки пользователей. Полный brownfield PRD-процесс подходит для данного масштаба изменений.

**Project Context**: Мы работаем в IDE с проектом Archon - системой управления знаниями на базе микросервисов, которая уже содержит существенную документацию и архитектуру.

### Existing Project Overview

**Analysis Source**: IDE-based fresh analysis

**Current Project State**: Archon - это система управления знаниями на основе микросервисной архитектуры, которая служит "командным центром" для AI-помощников по программированию. Проект включает веб-интерфейс для управления знаниями, контекстом и задачами, а также MCP-сервер для интеграции с AI-ассистентами (Claude Code, Cursor, Windsurf и др.).

### Available Documentation Analysis

Используется анализ проекта из доступной документации:
- ✓ Tech Stack Documentation 
- ✓ Source Tree/Architecture
- ✓ API Documentation  
- ✓ External API Documentation
- ✓ Technical Debt Documentation
- ⚠️ UX/UI Guidelines (may not be comprehensive)

### Enhancement Scope Definition

**Enhancement Type**: ✓ Major Feature Modification + ✓ Integration with New Systems

**Enhancement Description**: Реализация полной системы многопользовательской авторизации с токенизированным доступом через MCP, позволяющая каждому пользователю управлять собственными проектами и базой знаний с безопасным подключением через персональные токены. **Регистрация отложена** - только админ может добавлять пользователей и предоставлять доступ.

**Impact Assessment**: ✓ Significant Impact (substantial existing code changes)

### Goals and Background Context

#### Goals
• Безопасная многопользовательская среда с изоляцией данных
• Токенизированный доступ через MCP с персональными ключами  
• Административная модель управления пользователями без публичной регистрации
• Сохранение существующего UX для авторизованных пользователей
• Масштабируемая система управления правами доступа

#### Background Context
Текущая архитектура Archon предполагает локальное использование одним пользователем. Добавление многопользовательской авторизации требует фундаментальных изменений в архитектуре данных, API-эндпоинтах, MCP-сервере и UI. Это критично для использования в команде или организации, где каждый должен иметь доступ только к своим проектам и знаниям.

### Change Log
| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial PRD | 2025-08-25 | 1.0 | Создание brownfield PRD для многопользовательской авторизации | John (PM) |

## Requirements

### Functional Requirements

**FR1:** Административная панель должна позволять админу создавать новые учетные записи пользователей с указанием email, временного пароля и основных разрешений.

**FR2:** Система аутентификации должна позволить пользователям входить в систему используя предоставленные админом учетные данные с возможностью смены временного пароля при первом входе.

**FR3:** Каждый авторизованный пользователь должен иметь доступ только к собственным проектам, документам, задачам и источникам знаний с полной изоляцией от данных других пользователей.

**FR4:** Система генерации персональных MCP-токенов должна создавать уникальные API-ключи для каждого пользователя с возможностью создания, просмотра, отзыва и ротации токенов.

**FR5:** MCP-сервер должен валидировать MCP-токены и предоставлять доступ только к ресурсам соответствующего пользователя, сохраняя совместимость с существующими MCP-клиентами.

**FR6:** Существующие пользователи (single-user установки) должны автоматически мигрироваться как "admin user" с полными правами управления системой.

**FR7:** Админ должен иметь возможность деактивировать пользователей, сбрасывать пароли и управлять MCP-токенами всех пользователей.

**FR8:** API эндпоинты должны проверять принадлежность ресурсов текущему пользователю перед выполнением операций create, read, update, delete.

### Non Functional Requirements

**NFR1:** Производительность системы не должна ухудшиться более чем на 10% после внедрения многопользовательской авторизации при нормальной нагрузке (до 100 одновременных пользователей).

**NFR2:** Миграция существующих данных должна быть обратимой и завершаться в течение 15 минут для баз данных размером до 1GB.

**NFR3:** Система аутентификации должна соответствовать стандартам безопасности: хеширование паролей (bcrypt), защита от брутфорса, HTTPS-only для продакшена.

**NFR4:** MCP-токены должны быть криптографически стойкими (минимум 256 бит энтропии) и поддерживать опциональное время истечения.

**NFR5:** Система должна поддерживать до 1000 зарегистрированных пользователей и 50 активных MCP-подключений одновременно без деградации производительности.

**NFR6:** Веб-интерфейс должен оставаться отзывчивым (время загрузки < 3 секунд) после добавления проверок авторизации.

### Compatibility Requirements

**CR1: Existing API Compatibility** - Все текущие API эндпоинты должны продолжать работать для авторизованных пользователей с теми же форматами запросов и ответов.

**CR2: Database Schema Compatibility** - Добавление user_id должно происходить через миграции без изменения существующих столбцов и их типов данных.

**CR3: UI/UX Consistency** - Интерфейс должен сохранить существующие компоненты, навигацию и workflow после добавления элементов авторизации.

**CR4: MCP Protocol Compatibility** - MCP-сервер должен поддерживать текущий протокол с расширением для токенизированной авторизации, не нарушая работу существующих клиентов.

### Administrative Requirements

**AR1:** Админ-панель должна быть доступна только пользователям с admin-правами и предоставлять интуитивный интерфейс для управления пользователями.

**AR2:** Система должна поддерживать role-based access с базовыми ролями: admin (полный доступ) и user (доступ только к собственным данным).

**AR3:** Все административные действия должны логироваться для аудита безопасности.

## User Interface Enhancement Goals

### Integration with Existing UI

Новые UI элементы будут интегрированы с существующими паттернами Archon:
- **Существующая навигационная структура** остается неизменной с добавлением индикатора пользователя в header
- **Material Design компоненты** (уже используемые в React UI) будут применены для форм авторизации и админ-панели
- **TailwindCSS стили** будут соответствовать текущей цветовой схеме и типографике
- **Socket.IO real-time updates** будут расширены для уведомлений об изменениях пользователей
- **Responsive design** сохранит совместимость с мобильными устройствами

### Modified/New Screens and Views

**Новые экраны:**
- **Login Page** (`/login`) - форма авторизации с полями email/password
- **Admin Panel** (`/admin/users`) - управление пользователями (только для админов)
- **User Profile** (`/profile`) - настройки профиля и управление MCP-токенами
- **MCP Token Management** (`/profile/tokens`) - создание, просмотр и отзыв MCP-токенов

**Модифицированные экраны:**
- **Main Dashboard** - добавление user indicator и logout опции в header
- **Settings Page** - добавление секции "Account & Security"
- **Knowledge Base** - фильтрация по пользователю (автоматическая)
- **Projects Page** - отображение только пользовательских проектов
- **MCP Dashboard** - персонализированные токены и инструкции по подключению

### UI Consistency Requirements

**UC1:** Все формы авторизации должны использовать существующие компоненты формы и валидации из текущей системы Settings.

**UC2:** Цветовая схема и иконография должны соответствовать текущему дизайн-системе Archon с использованием существующих CSS переменных.

**UC3:** Навигационные паттерны должны сохранить текущую структуру меню с логичным добавлением новых разделов.

**UC4:** Уведомления об ошибках и успешных операциях должны использовать существующую Toast-систему.

**UC5:** Адаптивность интерфейса должна поддерживать все текущие breakpoints без нарушения функциональности на мобильных устройствах.

**UC6:** Загрузочные состояния и индикаторы прогресса должны следовать существующим паттернам с использованием тех же компонентов Spinner/Loading.

## Technical Constraints and Integration Requirements

### Existing Technology Stack

**Languages**: TypeScript (Frontend), Python 3.12+ (Backend)
**Frameworks**: React 18 + Vite (Frontend), FastAPI + uvicorn (Backend), Socket.IO для real-time
**Database**: Supabase (PostgreSQL + pgvector + RLS policies)
**Infrastructure**: Docker Compose для развертывания, nginx для reverse proxy
**External Dependencies**: OpenAI/Ollama для AI операций, MCP Protocol для интеграции с клиентами

### Integration Approach

**Database Integration Strategy**: 
- Добавление таблицы `users` с полями: id, email, password_hash, role, created_at, updated_at
- Добавление таблицы `mcp_tokens` с полями: id, user_id, token_hash, name, created_at, expires_at
- Миграция существующих таблиц с добавлением `user_id` foreign key
- Реализация Row Level Security (RLS) policies для автоматической фильтрации по пользователям

**API Integration Strategy**:
- Добавление JWT middleware в FastAPI для проверки авторизации
- Расширение всех существующих API эндпоинтов с user context
- Создание новых auth эндпоинтов: `/auth/login`, `/auth/logout`, `/auth/profile`
- Модификация MCP сервера для валидации токенов

**Frontend Integration Strategy**:
- Добавление AuthContext в React для управления состоянием пользователя
- Реализация защищенных маршрутов (PrivateRoute components)
- Интеграция с существующими API services для передачи JWT токенов
- Обновление Socket.IO клиента для пользовательской авторизации

**Testing Integration Strategy**:
- Расширение существующих тестов с мокированием пользователей
- Добавление integration тестов для multi-user сценариев
- Тестирование миграций данных и обратной совместимости

### Code Organization and Standards

**File Structure Approach**:
```
python/src/
├── auth/          # Новый модуль аутентификации
│   ├── models.py  # User, MCP Token models
│   ├── routes.py  # Auth endpoints
│   └── utils.py   # JWT, password hashing
├── middleware/    # JWT middleware
└── migrations/    # Database migration scripts

archon-ui-main/src/
├── contexts/      # AuthContext
├── components/auth/  # Login forms, User management
├── hooks/         # useAuth custom hook
└── services/      # Auth API services
```

**Naming Conventions**: Следование существующим conventions: kebab-case для файлов, PascalCase для React компонентов, snake_case для Python

**Coding Standards**: Соответствие существующим линтерам: ESLint для TypeScript, Ruff для Python, сохранение текущих настроек форматирования

**Documentation Standards**: Обновление существующих README файлов с инструкциями по настройке многопользовательского режима

### Deployment and Operations

**Build Process Integration**: Использование существующих Docker контейнеров с добавлением переменных окружения для JWT secrets

**Deployment Strategy**: 
- Поддержка обратной совместимости для single-user режима через переменную `MULTI_USER_MODE=false`
- Rolling deployment с миграцией базы данных перед обновлением сервисов
- Health check endpoints должны учитывать состояние аутентификации

**Monitoring and Logging**: 
- Добавление auth-related метрик в существующие Prometheus metrics
- Логирование попыток авторизации и административных действий
- Мониторинг количества активных пользователей и MCP соединений

**Configuration Management**: 
- JWT secrets через environment variables с надежной генерацией по умолчанию
- Конфигурация многопользовательского режима через существующий settings механизм
- Опциональные настройки timeout'ов для сессий и токенов

### Risk Assessment and Mitigation

**Technical Risks**: 
- Сложность миграции больших баз данных - митигация через поэтапные миграции и rollback план
- Производительность RLS policies - митигация через индексы на user_id и профилирование запросов

**Integration Risks**: 
- Breaking changes для существующих пользователей - митигация через feature flags и обратная совместимость
- MCP клиенты могут не поддерживать токенизацию - митигация через опциональные режимы аутентификации

**Deployment Risks**: 
- Downtime во время миграции - митигация через blue-green deployment для критических инсталляций
- JWT secret rotation сложности - митигация через документированные процедуры и tooling

**Mitigation Strategies**: 
- Comprehensive testing suite с multi-user scenarios
- Staged rollout с feature flags для постепенного включения функций
- Detailed rollback procedures и backup strategies для миграций данных

## Epic and Story Structure

### Epic Approach
**Epic Structure Decision**: Единый всеобъемлющий epic с обоснованием: многопользовательская авторизация требует координированных изменений во всех слоях архитектуры (база данных, API, UI, MCP-сервер). Разделение на несколько epic'ов создало бы зависимости и риски несогласованности между компонентами системы безопасности.

## Epic 1: Multi-User Authentication & Authorization System

**Epic Goal**: Трансформировать Archon из single-user системы в secure multi-user платформу с административным управлением пользователями и токенизированным MCP-доступом, сохранив полную функциональность для существующих пользователей.

**Integration Requirements**: 
- Seamless migration для существующих single-user инсталляций
- Zero-downtime deployment через feature flags и backward compatibility
- Сохранение всех существующих API contracts и UI workflows
- Интеграция с текущим стеком: Supabase RLS, FastAPI middleware, React contexts

### Story 1.1: Database Schema Migration & User Model Foundation

As a system administrator,
I want to extend the database schema with user management tables and migrate existing data,
so that the system can support multiple users while preserving all existing projects and data.

#### Acceptance Criteria
1. Новая таблица `users` создана с полями: id (UUID), email (unique), password_hash, role (admin/user), created_at, updated_at
2. Новая таблица `mcp_tokens` создана с связью к users и полями для безопасного хранения токенов
3. Все существующие таблицы (projects, tasks, sources, documents) расширены полем `user_id` с foreign key constraints
4. Создан "default admin user" для миграции существующих данных
5. Все existing data привязаны к default admin user без потери данных
6. Row Level Security (RLS) policies настроены для user-based изоляции данных

#### Integration Verification
**IV1:** Все существующие API эндпоинты продолжают возвращать те же данные для single-user режима
**IV2:** Существующие проекты, задачи и источники знаний остаются доступными и функциональными
**IV3:** Database performance не деградирует более чем на 5% после добавления RLS policies

### Story 1.2: Backend Authentication Infrastructure

As a developer,
I want to implement JWT-based authentication middleware and user management APIs,
so that the system can securely authenticate users and protect API endpoints.

#### Acceptance Criteria
1. JWT middleware реализован в FastAPI с проверкой токенов на всех protected endpoints
2. Authentication APIs созданы: POST /auth/login, POST /auth/logout, GET /auth/profile
3. Password hashing реализован с использованием bcrypt
4. User context передается через все existing API endpoints без breaking changes
5. Feature flag `MULTI_USER_MODE` позволяет включать/отключать авторизацию
6. Admin APIs созданы для управления пользователями: создание, деактивация, сброс пароля

#### Integration Verification
**IV1:** В single-user режиме все API endpoints работают без изменений в поведении
**IV2:** Existing frontend продолжает получать те же данные в том же формате
**IV3:** API response времена не увеличиваются более чем на 50ms для authenticated requests

### Story 1.3: MCP Server Token Authentication

As an AI coding assistant user,
I want to connect to Archon using personal MCP tokens,
so that I can access only my projects and knowledge while maintaining secure isolation from other users.

#### Acceptance Criteria
1. MCP server модифицирован для валидации MCP-токенов в HTTP headers
2. MCP token management API создан: создание, просмотр, отзыв токенов
3. Все MCP tools (perform_rag_query, manage_tasks, etc.) фильтруют данные по user context
4. Backward compatibility сохранена для existing MCP clients в single-user режиме
5. Token-based session management реализован с опциональными expiration dates
6. MCP connection logging добавлен для security auditing

#### Integration Verification
**IV1:** Existing MCP clients продолжают работать в single-user режиме без изменения конфигурации
**IV2:** Все MCP tools возвращают те же данные для авторизованного пользователя
**IV3:** MCP response времена не увеличиваются более чем на 100ms для token validation

### Story 1.4: Frontend Authentication & User Context

As a user,
I want to log into the Archon web interface and see only my own projects and data,
so that I can work securely in a multi-user environment while enjoying the same user experience.

#### Acceptance Criteria
1. Login page создана с формой email/password и integration с backend auth
2. AuthContext реализован в React для управления user state across приложения
3. Protected routes реализованы с автоматическим redirect на login для неавторизованных
4. User indicator добавлен в header с опцией logout
5. Все existing pages автоматически фильтруют данные по current user
6. JWT tokens автоматически включаются во все API requests

#### Integration Verification
**IV1:** Existing UI components и workflows остаются неизменными после авторизации
**IV2:** Navigation, layout, и все functional элементы работают идентично previous версии
**IV3:** Page load времена не увеличиваются более чем на 200ms после добавления auth checks

### Story 1.5: Admin Panel & User Management Interface

As a system administrator,
I want to manage users through a web interface,
so that I can create accounts, manage access, and maintain system security without command-line tools.

#### Acceptance Criteria
1. Admin panel доступна только users с admin role
2. User management interface позволяет создавать новых users с временными паролями
3. Admin может просматривать, деактивировать, и реактивировать user accounts
4. MCP token management для всех users доступно admin'у для security troubleshooting
5. User activity logging отображается в admin interface
6. Bulk operations поддерживаются для управления multiple users

#### Integration Verification
**IV1:** Admin operations не влияют на performance или availability системы для regular users
**IV2:** Existing admin может управлять всеми legacy данными через новый interface
**IV3:** Admin panel responsive design работает на всех supported устройствах

### Story 1.6: System Integration Testing & Security Hardening

As a system administrator,
I want comprehensive testing and security validation of the multi-user system,
so that I can confidently deploy the enhanced Archon in production environments.

#### Acceptance Criteria
1. Integration test suite покрывает multi-user scenarios: data isolation, token validation, admin operations
2. Security audit выполнен: password policies, JWT security, MCP token entropy
3. Migration testing подтверждает успешный переход от single-user к multi-user режиму
4. Performance benchmarks подтверждают соответствие NFR requirements
5. Rollback procedures протестированы и документированы
6. Production deployment guide обновлен с multi-user configuration

#### Integration Verification
**IV1:** Migration scripts успешно выполняются на test databases размером > 500MB
**IV2:** Load testing подтверждает support для 50+ concurrent users без деградации
**IV3:** Security scan не выявляет critical или high-severity уязвимостей