
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import { supabase } from './supabase'

type Idea = {
  id: string
  title: string
  tagline: string
  category: string
  author: string
  author_id: string
  created_at?: string
}

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

type RequestItem = {
  id: string
  idea_id: string
  requester_id?: string
  sponsor_id?: string
  owner_id: string
  message: string
  status?: string
  created_at: string
}

type Product = {
  id: string
  seller_id: string
  name: string
  description: string
  price: number
  created_at: string
}

const categories = [
  'All Ideas',
  'AI & Technology',
  'Environment',
  'Education',
  'Agriculture',
  'Healthcare',
  'Electronics',
]

function App() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [register, setRegister] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All Ideas')
  const [page, setPage] = useState('Explore Ideas')

  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(true)
  const [databaseMessage, setDatabaseMessage] = useState('')

  const [ideaOpen, setIdeaOpen] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaTagline, setIdeaTagline] = useState('')
  const [ideaCategory, setIdeaCategory] = useState('AI & Technology')
  const [ideaMessage, setIdeaMessage] = useState('')
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [chatPartner, setChatPartner] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatStatus, setChatStatus] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [collaborations, setCollaborations] = useState<RequestItem[]>([])
  const [sponsorships, setSponsorships] = useState<RequestItem[]>([])
  const [requestText, setRequestText] = useState('')
  const [requestStatus, setRequestStatus] = useState('')
  const [requestIdea, setRequestIdea] = useState<Idea | null>(null)
  const [requestType, setRequestType] = useState<'collaboration' | 'sponsor'>('collaboration')

  const [products, setProducts] = useState<Product[]>([])
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productStatus, setProductStatus] = useState('')
  const [showProductForm, setShowProductForm] = useState(false)

  const loadIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    setDatabaseMessage('')

    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('id, title, tagline, category, author_id, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      setIdeas((data ?? []).map((idea) => ({
        ...idea,
        author: idea.author_id === userId
          ? userEmail ?? 'You'
          : 'Community member',
      })))
    } catch (error) {
      setDatabaseMessage(error instanceof Error ? error.message : 'Could not load ideas.')
    } finally {
      setLoadingIdeas(false)
    }
  }, [userId, userEmail])

  const loadMessages = useCallback(async () => {
    if (!userId) {
      setMessages([])
      return
    }

    setChatLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: true })

    if (error) setChatStatus(error.message)
    else {
      setMessages(data ?? [])
      setChatStatus('')
    }
    setChatLoading(false)
  }, [userId])

  const loadRequests = useCallback(async () => {
    if (!userId) {
      setCollaborations([])
      setSponsorships([])
      return
    }

    const [collabResult, sponsorResult] = await Promise.all([
      supabase
        .from('collaboration_requests')
        .select('*')
        .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('sponsorship_requests')
        .select('*')
        .or(`sponsor_id.eq.${userId},owner_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
    ])

    if (collabResult.error) setRequestStatus(collabResult.error.message)
    else setCollaborations(collabResult.data ?? [])

    if (sponsorResult.error) setRequestStatus(sponsorResult.error.message)
    else setSponsorships(sponsorResult.data ?? [])
  }, [userId])

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, seller_id, name, description, price, created_at')
      .order('created_at', { ascending: false })

    if (error) setProductStatus(error.message)
    else {
      setProducts((data ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      })))
      setProductStatus('')
    }
  }, [])

  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) setAuthMessage(error.message)
      setUserEmail(data.session?.user.email ?? null)
      setUserId(data.session?.user.id ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      setUserId(session?.user.id ?? null)
    })

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    void loadIdeas()
  }, [loadIdeas])

  useEffect(() => {
    if (page === 'Messages') void loadMessages()
    if (page === 'Collaboration' || page === 'Sponsors') void loadRequests()
    if (page === 'Products') void loadProducts()
  }, [page, loadMessages, loadRequests, loadProducts])

  const filteredIdeas = useMemo(() => {
    const term = search.trim().toLowerCase()

    return ideas.filter((idea) => {
      const matchesSearch =
        !term ||
        idea.title.toLowerCase().includes(term) ||
        idea.tagline.toLowerCase().includes(term) ||
        idea.category.toLowerCase().includes(term)

      const matchesCategory =
        category === 'All Ideas' ||
        idea.category.toLowerCase() === category.toLowerCase()

      const matchesOwner = page !== 'My Ideas' || idea.author_id === userId

      return matchesSearch && matchesCategory && matchesOwner
    })
  }, [ideas, search, category, page, userId])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthMessage('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setAuthMessage('Password must contain at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        if (data.session) {
          setUserEmail(data.user?.email ?? email)
          setUserId(data.user?.id ?? null)
          setAuthOpen(false)
        } else {
          setAuthMessage('Registration submitted! Check your email if confirmation is required.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setUserEmail(data.user.email ?? email)
        setUserId(data.user.id)
        setAuthOpen(false)
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthMessage(error.message)
      return
    }

    setUserEmail(null)
    setUserId(null)
    setPage('Explore Ideas')
    setChatPartner(null)
  }

  async function createIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIdeaMessage('')

    if (!userId) {
      setIdeaMessage('Please log in before posting an idea.')
      return
    }

    const title = ideaTitle.trim()
    const tagline = ideaTagline.trim()

    if (!title || !tagline) {
      setIdeaMessage('Enter an idea title and description.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('ideas').insert({
        title,
        tagline,
        category: ideaCategory,
        author_id: userId,
      })
      if (error) throw error

      await loadIdeas()
      setIdeaTitle('')
      setIdeaTagline('')
      setIdeaCategory('AI & Technology')
      setIdeaOpen(false)
      setPage('Explore Ideas')
      setCategory('All Ideas')
      setSearch('')
    } catch (error) {
      setIdeaMessage(error instanceof Error ? error.message : 'Could not publish your idea.')
    } finally {
      setBusy(false)
    }
  }

  function choosePage(nextPage: string) {
    setPage(nextPage)
    setIdeaMessage('')
    setSelectedIdea(null)
    setRequestStatus('')
    setChatStatus('')
    setProductStatus('')
  }

  function openChat(idea: Idea) {
    if (!userId) {
      setAuthMessage('Please log in to message a creator.')
      setRegister(false)
      setAuthOpen(true)
      return
    }
    if (idea.author_id === userId) {
      setChatStatus('This is your own idea. Choose another creator to start a chat.')
      setPage('Messages')
      return
    }
    setChatPartner(idea.author_id)
    setChatStatus('')
    setSelectedIdea(null)
    setPage('Messages')
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || !chatPartner) {
      setChatStatus('Open a chat from another creator’s idea first.')
      return
    }

    const body = chatText.trim()
    if (!body) return

    setBusy(true)
    setChatStatus('')
    const { error } = await supabase.from('messages').insert({
      sender_id: userId,
      recipient_id: chatPartner,
      body,
    })

    if (error) setChatStatus(error.message)
    else {
      setChatText('')
      await loadMessages()
    }
    setBusy(false)
  }

  function openRequest(idea: Idea, type: 'collaboration' | 'sponsor') {
    if (!userId) {
      setRegister(false)
      setAuthMessage('Please log in to send a request.')
      setAuthOpen(true)
      return
    }
    if (idea.author_id === userId) {
      setRequestStatus('You cannot send a request to your own idea.')
      return
    }
    setRequestIdea(idea)
    setRequestType(type)
    setRequestText(
      type === 'collaboration'
        ? 'Hi! I would like to collaborate on your project.'
        : 'Hello! I am interested in supporting your project.',
    )
    setRequestStatus('')
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || !requestIdea) return

    setBusy(true)
    setRequestStatus('')
    const table = requestType === 'collaboration'
      ? 'collaboration_requests'
      : 'sponsorship_requests'

    const payload = requestType === 'collaboration'
      ? {
          idea_id: requestIdea.id,
          requester_id: userId,
          owner_id: requestIdea.author_id,
          message: requestText.trim() || 'I would like to collaborate!',
        }
      : {
          idea_id: requestIdea.id,
          sponsor_id: userId,
          owner_id: requestIdea.author_id,
          message: requestText.trim() || 'I am interested in sponsoring this idea.',
        }

    const { error } = await supabase.from(table).insert(payload)

    if (error) setRequestStatus(error.message)
    else {
      setRequestStatus('Request sent successfully!')
      await loadRequests()
      setRequestIdea(null)
    }
    setBusy(false)
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) {
      setRegister(false)
      setAuthMessage('Please log in to list a product.')
      setAuthOpen(true)
      return
    }

    const name = productName.trim()
    if (!name) {
      setProductStatus('Enter a product name.')
      return
    }

    const price = Number(productPrice)
    if (!Number.isFinite(price) || price < 0) {
      setProductStatus('Enter a valid price.')
      return
    }

    setBusy(true)
    setProductStatus('')
    const { error } = await supabase.from('products').insert({
      seller_id: userId,
      name,
      description: productDescription.trim(),
      price,
    })

    if (error) setProductStatus(error.message)
    else {
      setProductName('')
      setProductDescription('')
      setProductPrice('')
      setShowProductForm(false)
      await loadProducts()
      setProductStatus('Product listed successfully!')
    }
    setBusy(false)
  }

  const visibleMessages = messages.filter((message) =>
    chatPartner
      ? message.sender_id === chatPartner || message.recipient_id === chatPartner
      : true,
  )

  const conversationPartners = Array.from(
    new Set(messages.map((message) =>
      message.sender_id === userId ? message.recipient_id : message.sender_id,
    )),
  )

  const ideaTitleFor = (id: string) =>
    ideas.find((idea) => idea.id === id)?.title ?? 'Project'

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => choosePage('Explore Ideas')} aria-label="IDEA MARKET MEGA home">
          <span className="brand-mark">IM</span>
          <span><strong>IDEA MARKET</strong><small>MEGA</small></span>
        </button>

        <div className="top-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search ideas"
            placeholder="Search ideas, technology, projects..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="top-actions">
          {userEmail ? (
            <>
              <span className="user-label">{userEmail}</span>
              <button className="button button-light" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="button button-light" onClick={() => { setRegister(false); setAuthMessage(''); setAuthOpen(true) }}>Log in</button>
              <button className="button button-primary" onClick={() => { setRegister(true); setAuthMessage(''); setAuthOpen(true) }}>Join free</button>
            </>
          )}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <p className="side-heading">WORKSPACE</p>
          {[
            ['Explore Ideas', '⌂'],
            ['My Ideas', '▤'],
            ['Messages', '✉'],
            ['Collaboration', '🤝'],
            ['Sponsors', '◇'],
            ['Products', '▦'],
            ['Hackathons', '⚑'],
            ['My Profile', '○'],
          ].map(([label, symbol]) => (
            <button key={label} className={`side-link ${page === label ? 'active' : ''}`} onClick={() => choosePage(label)}>
              <span className="side-symbol">{symbol}</span><span>{label}</span>
            </button>
          ))}

          <div className="sidebar-note">
            <span className="note-icon">✦</span>
            <strong>Have an idea?</strong>
            <p>Your next project could start here.</p>
            <button className="button button-primary button-full" onClick={() => { setIdeaMessage(''); setIdeaOpen(true) }}>+ Post an idea</button>
          </div>
          <div className="sidebar-bottom"><span className="brand-mark small-mark">IM</span><span>Built for makers and dreamers.</span></div>
        </aside>

        <main className="main-content">
          {(page === 'Explore Ideas' || page === 'My Ideas') && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">THINK IT. BUILD IT. SHARE IT.</p>
                  <h1>{page === 'My Ideas' ? 'Your ideas, your journey.' : 'Big ideas start somewhere.'}</h1>
                  <p className="welcome-description">
                    {page === 'My Ideas' ? 'Manage the ideas you have published.' : 'Discover projects, share what you are building, and find people who want to build with you.'}
                  </p>
                </div>
                <button className="button button-primary post-button" onClick={() => { setIdeaMessage(''); setIdeaOpen(true) }}>+ Post an idea</button>
              </section>

              {page === 'Explore Ideas' && (
                <section className="stats-row">
                  <div className="stat-card"><span className="stat-icon blue">✦</span><div><strong>{ideas.length}</strong><span>Published ideas</span></div></div>
                  <div className="stat-card"><span className="stat-icon purple">♧</span><div><strong>{userEmail ? '1' : '0'}</strong><span>Your signed-in account</span></div></div>
                  <div className="stat-card"><span className="stat-icon green">↗</span><div><strong>Open</strong><span>Room to collaborate</span></div></div>
                </section>
              )}

              <section className="ideas-section">
                <div className="section-heading">
                  <div><h2>{page === 'My Ideas' ? 'My published ideas' : 'Explore ideas'}</h2><p>{page === 'My Ideas' ? 'Only ideas posted by your account appear here.' : 'Ideas published by users in the marketplace.'}</p></div>
                  <span className="result-count">{filteredIdeas.length} results</span>
                </div>

                <div className="category-pills">
                  {categories.map((item) => <button key={item} className={`category-pill ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
                </div>

                {databaseMessage && <div className="empty-state"><h3>Could not load ideas</h3><p>{databaseMessage}</p><button className="button button-light" onClick={() => void loadIdeas()}>Try again</button></div>}
                {loadingIdeas && !databaseMessage && <p className="notice-message">Loading ideas from the database...</p>}

                {!loadingIdeas && !databaseMessage && (
                  <>
                    <div className="idea-grid">
                      {filteredIdeas.map((idea) => (
                        <article className="idea-card" key={idea.id}>
                          <div className="idea-card-top"><span className="idea-category">{idea.category}</span><span className="idea-menu" aria-hidden="true">•••</span></div>
                          <div className="idea-art" aria-hidden="true">{idea.category.toLowerCase().includes('environment') ? '♻' : idea.category.toLowerCase().includes('agriculture') ? '🌱' : '✧'}</div>
                          <h3>{idea.title}</h3><p className="idea-tagline">{idea.tagline}</p>
                          <div className="idea-card-footer">
                            <span className="author-avatar">{idea.author.charAt(0).toUpperCase()}</span><span className="author-name">{idea.author}</span>
                            <button className="text-action" onClick={() => setSelectedIdea(idea)}>View idea →</button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {filteredIdeas.length === 0 && <div className="empty-state"><span>⌕</span><h3>{page === 'My Ideas' ? 'You have not posted any ideas yet' : 'No ideas found'}</h3><p>{page === 'My Ideas' ? 'Post your first idea to get started.' : 'Try another search or choose a different category.'}</p><button className="button button-primary" onClick={() => { setIdeaMessage(''); setIdeaOpen(true) }}>+ Post an idea</button></div>}
                  </>
                )}
              </section>
            </>
          )}

          {page === 'Messages' && (
            <section className="ideas-section">
              <div className="welcome-row">
                <div><p className="eyebrow">CONNECT WITH CREATORS</p><h1>Messages 💬</h1><p className="welcome-description">Open a chat from an idea's details to contact its creator.</p></div>
                <button className="button button-light" onClick={() => void loadMessages()}>Refresh</button>
              </div>
              {!userId && <div className="empty-state"><h3>Log in to use Messages</h3><button className="button button-primary" onClick={() => { setRegister(false); setAuthOpen(true) }}>Log in</button></div>}
              {userId && (
                <>
                  {chatStatus && <p className="auth-message" role="status">{chatStatus}</p>}
                  <div className="stats-row">
                    <div className="stat-card"><div><strong>{conversationPartners.length}</strong><span>Conversations</span></div></div>
                    <div className="stat-card"><div><strong>{messages.length}</strong><span>Messages loaded</span></div></div>
                  </div>
                  {conversationPartners.length > 0 && <div className="category-pills">{conversationPartners.map((partner) => <button key={partner} className={`category-pill ${chatPartner === partner ? 'selected' : ''}`} onClick={() => { setChatPartner(partner); setChatStatus('') }}>Chat · {partner.slice(0, 8)}</button>)}</div>}
                  {!chatPartner && <div className="empty-state"><h3>Start a conversation</h3><p>Go to Explore Ideas, open an idea posted by another user, then choose “Message creator”.</p><button className="button button-primary" onClick={() => choosePage('Explore Ideas')}>Explore ideas</button></div>}
                  {chatPartner && (
                    <div className="idea-card">
                      <div className="section-heading"><div><h2>Conversation</h2><p>Chat with member {chatPartner.slice(0, 8)}</p></div><button className="button button-light" onClick={() => setChatPartner(null)}>Close chat</button></div>
                      {chatLoading ? <p>Loading messages...</p> : (
                        <div className="chat-history">
                          {visibleMessages.filter((m) => (m.sender_id === userId && m.recipient_id === chatPartner) || (m.sender_id === chatPartner && m.recipient_id === userId)).map((message) => (
                            <div key={message.id} className="chat-message" style={{ padding: '10px', margin: '8px 0', borderRadius: '10px', background: message.sender_id === userId ? '#e8f2ff' : '#f2f2f2' }}>
                              <strong>{message.sender_id === userId ? 'You' : 'Creator'}</strong><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small>
                            </div>
                          ))}
                          {visibleMessages.filter((m) => (m.sender_id === userId && m.recipient_id === chatPartner) || (m.sender_id === chatPartner && m.recipient_id === userId)).length === 0 && <p>No messages yet. Send the first message below.</p>}
                        </div>
                      )}
                      <form className="idea-form" onSubmit={sendMessage}>
                        <label htmlFor="chat-text">Your message</label>
                        <textarea id="chat-text" value={chatText} onChange={(e) => setChatText(e.target.value)} maxLength={2000} rows={3} placeholder="Write a message..." required />
                        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send message'}</button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {page === 'Collaboration' && (
            <section className="ideas-section">
              <div className="welcome-row"><div><p className="eyebrow">BUILD TOGETHER</p><h1>Collaboration 🤝</h1><p className="welcome-description">Send collaboration requests from any idea's details and manage your requests here.</p></div><button className="button button-light" onClick={() => void loadRequests()}>Refresh</button></div>
              {!userId ? <div className="empty-state"><h3>Log in to collaborate</h3><button className="button button-primary" onClick={() => { setRegister(false); setAuthOpen(true) }}>Log in</button></div> : (
                <>
                  {requestStatus && <p className="auth-message" role="status">{requestStatus}</p>}
                  {collaborations.length === 0 ? <div className="empty-state"><h3>No collaboration requests yet</h3><p>Open Explore Ideas and choose Collaborate on a project.</p><button className="button button-primary" onClick={() => choosePage('Explore Ideas')}>Explore ideas</button></div> : collaborations.map((item) => <article className="idea-card" key={item.id}><span className="idea-category">{item.status ?? 'pending'}</span><h3>{ideaTitleFor(item.idea_id)}</h3><p>{item.message}</p><p className="notice-message">{item.requester_id === userId ? 'Request sent by you' : 'Request received by you'}</p></article>)}
                </>
              )}
            </section>
          )}

          {page === 'Sponsors' && (
            <section className="ideas-section">
              <div className="welcome-row"><div><p className="eyebrow">SUPPORT GOOD IDEAS</p><h1>Sponsors 💰</h1><p className="welcome-description">Send a sponsorship enquiry from an idea's details or review requests here.</p></div><button className="button button-light" onClick={() => void loadRequests()}>Refresh</button></div>
              {!userId ? <div className="empty-state"><h3>Log in to access sponsorships</h3><button className="button button-primary" onClick={() => { setRegister(false); setAuthOpen(true) }}>Log in</button></div> : (
                <>
                  {requestStatus && <p className="auth-message" role="status">{requestStatus}</p>}
                  {sponsorships.length === 0 ? <div className="empty-state"><h3>No sponsorship requests yet</h3><p>Explore an idea and choose “Sponsor this idea” to send an enquiry.</p><button className="button button-primary" onClick={() => choosePage('Explore Ideas')}>Explore ideas</button></div> : sponsorships.map((item) => <article className="idea-card" key={item.id}><span className="idea-category">Sponsorship enquiry</span><h3>{ideaTitleFor(item.idea_id)}</h3><p>{item.message}</p><p className="notice-message">{item.sponsor_id === userId ? 'Sent by you' : 'Received by you'}</p></article>)}
                </>
              )}
            </section>
          )}

          {page === 'Products' && (
            <section className="ideas-section">
              <div className="welcome-row"><div><p className="eyebrow">MAKER MARKETPLACE</p><h1>Products 🛍️</h1><p className="welcome-description">Browse electronic components, Arduino parts, and project supplies listed by users.</p></div><button className="button button-primary" onClick={() => { setShowProductForm(!showProductForm); setProductStatus('') }}>{showProductForm ? 'Cancel' : '+ List a product'}</button></div>
              {productStatus && <p className="auth-message" role="status">{productStatus}</p>}
              {showProductForm && <article className="idea-card"><h2>List a product</h2><form className="idea-form" onSubmit={submitProduct}><label htmlFor="product-name">Product name</label><input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={100} placeholder="e.g. Arduino Uno" required /><label htmlFor="product-description">Description</label><textarea id="product-description" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Condition, details, and uses" /><label htmlFor="product-price">Price (₹)</label><input id="product-price" type="number" min="0" step="0.01" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="0" required /><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Publish product'}</button></form></article>}
              {products.length === 0 ? <div className="empty-state"><h3>No products listed yet</h3><p>Be the first to list an electronic component or project supply.</p></div> : <div className="idea-grid">{products.map((product) => <article className="idea-card" key={product.id}><div className="idea-art">⚙</div><h3>{product.name}</h3><p className="idea-tagline">{product.description || 'No description provided.'}</p><h3>₹{product.price.toLocaleString('en-IN')}</h3><p className="notice-message">{product.seller_id === userId ? 'Listed by you' : `Seller ${product.seller_id.slice(0, 8)}`}</p></article>)}</div>}
            </section>
          )}

          {page === 'Hackathons' && (
            <section className="placeholder-page"><span className="placeholder-icon">⚑</span><p className="eyebrow">IDEA MARKET MEGA</p><h1>Hackathons</h1><p>Hackathon listings and registrations are planned for a future update.</p><button className="button button-light" onClick={() => choosePage('Explore Ideas')}>Back to Explore Ideas</button></section>
          )}

          {page === 'My Profile' && (
            <section className="placeholder-page"><span className="placeholder-icon">○</span><p className="eyebrow">IDEA MARKET MEGA</p><h1>My Profile</h1><p>{userEmail ? `Signed in as ${userEmail}` : 'Log in to view your account.'}</p><p>Your extended profile, followers, and earnings are planned for a future update.</p>{!userEmail && <button className="button button-primary" onClick={() => { setRegister(false); setAuthOpen(true) }}>Log in</button>}<button className="button button-light" onClick={() => choosePage('Explore Ideas')}>Back to Explore Ideas</button></section>
          )}

          <footer className="app-footer"><span>© 2026 IDEA MARKET MEGA</span><span>Made for people who turn ideas into projects.</span></footer>
        </main>
      </div>

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false) }}>
          <section className="modal-panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}>×</button>
            <div className="auth-brand-mark">IM</div><p className="eyebrow">WELCOME TO IDEA MARKET MEGA</p>
            <h2 id="auth-title">{register ? 'Create your account' : 'Welcome back'}</h2>
            <p className="modal-description">{register ? 'Create an account to start sharing your ideas.' : 'Log in to continue building something great.'}</p>
            <form className="auth-form" onSubmit={handleAuth}>
              <label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required />
              <label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={6} maxLength={72} placeholder="At least 6 characters" required />
              {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
              <button className="button button-primary button-full auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Log in'}</button>
            </form>
            <p className="auth-switch-row">{register ? 'Already have an account?' : 'New to Idea Market?'} <button className="inline-action" onClick={() => { setRegister(!register); setAuthMessage('') }}>{register ? 'Log in' : 'Join free'}</button></p>
            <p className="auth-security-note">Your account is handled by Supabase Authentication.</p>
          </section>
        </div>
      )}

      {ideaOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setIdeaOpen(false) }}>
          <section className="modal-panel idea-form-panel" role="dialog" aria-modal="true" aria-labelledby="idea-form-title">
            <button className="modal-close" aria-label="Close" onClick={() => setIdeaOpen(false)}>×</button>
            <p className="eyebrow">SHARE WHAT YOU ARE BUILDING</p><h2 id="idea-form-title">Post an idea</h2>
            <p className="modal-description">Add a clear title and a short description for your project.</p>
            <form className="idea-form" onSubmit={createIdea}>
              <label htmlFor="idea-title">Idea title</label><input id="idea-title" value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} maxLength={100} placeholder="e.g. Smart irrigation system" required />
              <label htmlFor="idea-category">Category</label><select id="idea-category" value={ideaCategory} onChange={(e) => setIdeaCategory(e.target.value)}>{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <label htmlFor="idea-tagline">Short description</label><textarea id="idea-tagline" value={ideaTagline} onChange={(e) => setIdeaTagline(e.target.value)} maxLength={300} placeholder="What problem does your idea solve?" rows={4} required />
              {ideaMessage && <p className="auth-message" role="status">{ideaMessage}</p>}
              <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? 'Publishing...' : 'Publish idea'}</button>
            </form>
          </section>
        </div>
      )}

      {selectedIdea && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIdea(null) }}>
          <section className="modal-panel idea-form-panel" role="dialog" aria-modal="true" aria-labelledby="selected-idea-title">
            <button className="modal-close" aria-label="Close" onClick={() => setSelectedIdea(null)}>×</button>
            <p className="eyebrow">{selectedIdea.category}</p><h2 id="selected-idea-title">{selectedIdea.title}</h2>
            <p className="modal-description">{selectedIdea.tagline}</p><p className="author-name">Posted by: {selectedIdea.author}</p>
            <div className="idea-form">
              <button className="button button-primary" onClick={() => openChat(selectedIdea)}>✉ Message creator</button>
              <button className="button button-light" onClick={() => { openRequest(selectedIdea, 'collaboration'); setSelectedIdea(null) }}>🤝 Collaborate</button>
              <button className="button button-light" onClick={() => { openRequest(selectedIdea, 'sponsor'); setSelectedIdea(null) }}>◇ Sponsor this idea</button>
            </div>
            <button className="button button-light" onClick={() => setSelectedIdea(null)}>Close</button>
          </section>
        </div>
      )}

      {requestIdea && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setRequestIdea(null) }}>
          <section className="modal-panel idea-form-panel" role="dialog" aria-modal="true" aria-labelledby="request-title">
            <button className="modal-close" aria-label="Close" onClick={() => setRequestIdea(null)}>×</button>
            <p className="eyebrow">{requestType === 'collaboration' ? 'BUILD TOGETHER' : 'SUPPORT A PROJECT'}</p>
            <h2 id="request-title">{requestType === 'collaboration' ? 'Collaboration request' : 'Sponsorship enquiry'}</h2>
            <p className="modal-description">For: {requestIdea.title}</p>
            <form className="idea-form" onSubmit={submitRequest}>
              <label htmlFor="request-message">Your message</label>
              <textarea id="request-message" value={requestText} onChange={(e) => setRequestText(e.target.value)} maxLength={1000} rows={4} required />
              {requestStatus && <p className="auth-message" role="status">{requestStatus}</p>}
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send request'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
