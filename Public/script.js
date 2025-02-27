document.getElementById("imagem").addEventListener("change", atualizarPreview);
document.getElementById("conteudo").addEventListener("input", atualizarPreview);
document.getElementById("data_hora").addEventListener("input", atualizarPreview);

function atualizarPreview() {
    const file = document.getElementById("imagem").files[0];
    const conteudo = document.getElementById("conteudo").value;
    const dataHora = document.getElementById("data_hora").value;
    const preview = document.getElementById("preview");

    preview.innerHTML = "";

    if (conteudo) {
        preview.innerHTML += `<p><strong>Legenda:</strong> ${conteudo}</p>`;
    }
    if (dataHora) {
        preview.innerHTML += `<p><strong>Data e Hora:</strong> ${new Date(dataHora).toLocaleString("pt-BR")}</p>`;
    }

    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            const img = document.createElement("img");
            img.src = reader.result;
            img.alt = "Preview da Imagem";
            img.style.maxWidth = "100%";
            img.style.marginTop = "10px";
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

function exibirMensagem(tipo, texto) {
    const mensagem = document.getElementById("statusMessage");
    if (!mensagem) return;
  
    mensagem.classList.remove("hidden");
    
    if (tipo === "sucesso") {
        mensagem.style.backgroundColor = "#d4edda"; 
        mensagem.style.color = "#155724"; 
    } else {
        mensagem.style.backgroundColor = "#f8d7da"; 
        mensagem.style.color = "#721c24"; 
    }

    mensagem.innerHTML = texto;

    // Ocultar após 7 segundos
    setTimeout(() => {
        mensagem.classList.add("hidden");
        mensagem.innerHTML = "";
    }, 5000);
}



document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const dataHoraInput = document.getElementById("data_hora").value;
    if (!dataHoraInput) {
        exibirMensagem("erro", "Por favor, preencha a data e a hora.");
        return;
    }

    const dataHoraLocal = new Date(dataHoraInput);
    if (isNaN(dataHoraLocal.getTime())) {
        exibirMensagem("erro", "⚠️ Data e hora inválidas!");
        return;
    }

    const offset = dataHoraLocal.getTimezoneOffset() * 60000;
    const dataHoraISO = new Date(dataHoraLocal.getTime() - offset).toISOString();
    formData.set("data_hora", dataHoraISO);

    try {
        const response = await fetch("/upload", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Falha ao enviar a postagem.");
        const result = await response.json();

        exibirMensagem("sucesso", "✅Postagem agendada com sucesso!");
        e.target.reset();
        document.getElementById("preview").innerHTML = "";
        carregarPostagens();
    } catch (err) {
        console.error("Erro:", err);
        exibirMensagem("erro", "❌Erro ao agendar a postagem.");
    }
});

async function carregarPostagens() {
    try {
        const res = await fetch("/postagens");
        if (!res.ok) throw new Error("Falha ao carregar postagens.");
        const postagens = await res.json();
        const lista = document.getElementById("postagens");
        lista.innerHTML = "";

        postagens.forEach(post => {
            const dataHoraFormatada = new Date(post.data_hora).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo"
            });

            const imagemHtml = post.imagem_url
                ? `<img src="${post.imagem_url}" alt="Imagem Agendada" style="max-width: 300px; display: block; margin: 10px 0;">`
                : "";

            lista.innerHTML += `
                <li style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <p><strong>Legenda:</strong> ${post.conteudo}</p>
                    <p><strong>Data e Hora:</strong> ${dataHoraFormatada}</p>
                    <p><strong>Status:</strong> ${post.status}</p>
                    ${imagemHtml}
                    <button style="background-color: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;" onclick="deletarPostagem(${post.id})">🗑️ Deletar</button>
                </li>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar postagens:", error);
        exibirMensagem("erro", "❌ Falha ao carregar as postagens.");
    }
}

async function deletarPostagem(id) {
    if (confirm("Tem certeza que deseja excluir esta postagem?")) {
        try {
            const res = await fetch(`/postagens/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Falha ao excluir a postagem.");
            exibirMensagem("sucesso", "✅Postagem excluída com sucesso!");
            carregarPostagens();
        } catch (error) {
            console.error("Erro ao excluir postagem:", error);
            exibirMensagem("erro", "❌ Erro ao excluir a postagem.");
        }
    }
}

window.onload = carregarPostagens;
