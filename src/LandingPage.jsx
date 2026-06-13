import { useState } from 'react';
import './LandingPage.css';

export default function LandingPage({ onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    console.log('Lead Ghost Project AI:', formData);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setSubmitSuccess(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        company: '',
        phone: '',
        message: ''
      });
      setSubmitSuccess(false);
    }, 3000);
  };

  return (
    <div className="landing-page">
      <div className="landing-overlay" onClick={onClose} />
      
      <div className="landing-content">
        {/* Header */}
        <header className="landing-header">
          <div className="landing-logo">
            <h1>GHOST PROJECT AI</h1>
            <p className="landing-tagline">The Future of AR Commerce</p>
          </div>
          <button className="landing-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {/* Hero Section */}
        <section className="landing-hero">
          <h2 className="landing-hero-title">
            Transforme Sua Loja em Uma Experiência de Realidade Aumentada
          </h2>
          <p className="landing-hero-subtitle">
            Reduza devoluções em até 50% e aumente conversões com tecnologia AR de precisão anatômica
          </p>
        </section>

        {/* Features Grid */}
        <section className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Redução de Devoluções</h3>
            <p>Elimine dúvidas sobre escala, proporção e ajuste do produto antes da compra</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Performance Cinemática</h3>
            <p>Renderização fluida e tracking estável em tempo real para dispositivos móveis</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔧</div>
            <h3>Integração Modular</h3>
            <p>Arquitetura preparada para integração rápida em plataformas de e-commerce</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Tracking Anatômico</h3>
            <p>Precisão de alinhamento superior às soluções convencionais do mercado</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>Zero Instalação</h3>
            <p>Experiência AR diretamente no navegador, sem apps ou downloads</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💎</div>
            <h3>Silent Luxury</h3>
            <p>Design minimalista e sofisticado que valoriza seus produtos premium</p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="landing-cta-section">
          <h2 className="landing-cta-title">Solicite Acesso Completo</h2>
          <p className="landing-cta-description">
            Entre para a lista de acesso exclusivo e descubra como o Ghost Project AI pode revolucionar sua operação de e-commerce
          </p>
        </section>

        {/* Form */}
        <section className="landing-form-section">
          {submitSuccess ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h3>Solicitação Enviada com Sucesso!</h3>
              <p>Nossa equipe entrará em contato em breve para agendar sua demonstração privada.</p>
            </div>
          ) : (
            <form className="landing-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Nome Completo *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Seu nome"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">E-mail Corporativo *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company">Empresa *</label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    required
                    placeholder="Nome da empresa"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="phone">Telefone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message">Mensagem</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Conte-nos sobre seu projeto e necessidades..."
                />
              </div>

              <button 
                type="submit" 
                className="landing-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'ENVIANDO...' : 'SOLICITAR ACESSO COMPLETO'}
              </button>

              <p className="form-privacy">
                Seus dados estão protegidos de acordo com diretrizes globais de privacidade. 
                Não compartilhamos informações com terceiros.
              </p>
            </form>
          )}
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>© 2026 Ghost Project AI. Tecnologia de ponta para o e-commerce do futuro.</p>
        </footer>
      </div>
    </div>
  );
}
